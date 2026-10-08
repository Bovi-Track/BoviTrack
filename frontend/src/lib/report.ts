import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { bovineLabel, computeMetrics, saleHints } from './dashboard.ts'
import {
  EXPECTED_GMD_KG,
  LOW_GMD_KG,
  buildWeeklyReport,
  formatPct,
  formatSigned,
  type WeeklyReport,
} from './gmd.ts'
import type { Bovine, SaleHint, Treatment, Weighing } from '../types/dashboard.ts'

export type ReportSectionId =
  | 'semanal'
  | 'resumen'
  | 'toros'
  | 'pesajes'
  | 'inventario'
  | 'tratamientos'
  | 'venta'

export type ReportSection = {
  id: ReportSectionId
  label: string
  description: string
}

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: 'semanal',
    label: 'Reporte semanal',
    description: 'Peso, GMD semanal de los sábados y estructura del hato.',
  },
  {
    id: 'resumen',
    label: 'Resumen de la finca',
    description: 'Toros activos, GMD global y alertas pendientes.',
  },
  {
    id: 'toros',
    label: 'Inventario de toros',
    description: 'Listado de bovinos con DIIO, raza, sexo y estado.',
  },
  {
    id: 'pesajes',
    label: 'Historial de pesajes',
    description: 'Peso y fecha de cada registro del hato.',
  },
  {
    id: 'inventario',
    label: 'Inventario de bodega',
    description: 'Existencias e insumos de la finca.',
  },
  {
    id: 'tratamientos',
    label: 'Tratamientos y alertas',
    description: 'Próximas aplicaciones sanitarias.',
  },
  {
    id: 'venta',
    label: 'Evaluación de venta',
    description: 'Sugerencias de venta según peso y GMD.',
  },
]

export type ReportData = {
  farmName: string
  farmLocation: string | null
  generatedAt: string
  bovines: Bovine[]
  weighings: Weighing[]
  treatments: Treatment[]
}

export type ReportSelection = Record<ReportSectionId, boolean>

export function defaultReportSelection(): ReportSelection {
  return {
    semanal: true,
    resumen: true,
    toros: true,
    pesajes: true,
    inventario: false,
    tratamientos: true,
    venta: true,
  }
}

export function selectedSectionCount(selection: ReportSelection) {
  return REPORT_SECTIONS.filter((section) => selection[section.id]).length
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

function statusLabel(estado: Bovine['estado']) {
  const map: Record<Bovine['estado'], string> = {
    ACTIVO: 'Activo',
    INACTIVO: 'Inactivo',
    VENDIDO: 'Vendido',
    BAJA: 'Baja',
    MUERTO: 'Muerto',
  }
  return map[estado]
}

function saleLabel(status: SaleHint['status']) {
  if (status === 'apto') return 'Apto para venta'
  if (status === 'falta') return 'Falta información'
  return 'Mantener'
}

function lastTableY(doc: jsPDF) {
  const extra = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  return extra.lastAutoTable?.finalY ?? 20
}

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  const bottom = doc.internal.pageSize.getHeight() - 18
  if (y + needed <= bottom) return y
  doc.addPage()
  return 18
}

function addHeading(doc: jsPDF, y: number, title: string) {
  const next = ensureSpace(doc, y, 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(28, 25, 23)
  doc.text(title, 14, next)
  return next + 6
}

function addNote(doc: jsPDF, y: number, text: string) {
  const next = ensureSpace(doc, y, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 113, 108)
  const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - 28)
  doc.text(lines, 14, next)
  return next + lines.length * 4 + 2
}

function addTable(
  doc: jsPDF,
  y: number,
  head: string[],
  body: string[][],
) {
  autoTable(doc, {
    startY: y,
    head: [head],
    body: body.length > 0 ? body : [['Sin datos']],
    styles: { fontSize: 9, cellPadding: 2.2, textColor: [68, 64, 60] },
    headStyles: {
      fillColor: [27, 93, 59],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [250, 247, 242] },
    margin: { left: 14, right: 14 },
  })
  return lastTableY(doc) + 8
}

function safeFarmSlug(farmName: string) {
  return farmName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function suggestedReportFilename(farmName: string, generatedAt: string) {
  const date = generatedAt.slice(0, 10)
  return `BoviTrack-${safeFarmSlug(farmName) || 'finca'}-${date}.pdf`
}

export function suggestedWeeklyFilename(farmName: string, saturday: string) {
  return `BoviTrack-${safeFarmSlug(farmName) || 'finca'}-semanal-${saturday}.pdf`
}

function formatDayLong(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function kgLabel(value: number | null, digits: number) {
  return value == null ? '—' : `${value.toFixed(digits)} Kg`
}

function drawChangeBadge(doc: jsPDF, x: number, y: number, changePct: number | null) {
  const change = formatPct(changePct)
  const label = change?.text ?? '—'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  const width = Math.max(14, doc.getTextWidth(label) + 5)
  if (!change) {
    doc.setFillColor(243, 244, 246)
    doc.setTextColor(156, 163, 175)
  } else if (change.up) {
    doc.setFillColor(236, 253, 245)
    doc.setTextColor(5, 150, 105)
  } else {
    doc.setFillColor(255, 241, 242)
    doc.setTextColor(225, 29, 72)
  }
  doc.roundedRect(x, y, width, 6, 1.2, 1.2, 'F')
  doc.text(label, x + width / 2, y + 4.2, { align: 'center' })
  return width
}

type MetricIcon = 'scale' | 'beef' | 'calendar' | 'activity'

function drawMetricIcon(doc: jsPDF, kind: MetricIcon, cx: number, cy: number) {
  doc.setDrawColor(87, 83, 78)
  doc.setFillColor(87, 83, 78)
  doc.setLineWidth(0.45)
  doc.setLineCap('round')
  doc.setLineJoin('round')

  if (kind === 'scale') {
    doc.line(cx - 3.2, cy - 0.4, cx + 3.2, cy - 0.4)
    doc.line(cx, cy - 2.4, cx, cy + 2.6)
    doc.line(cx - 2.2, cy + 2.6, cx + 2.2, cy + 2.6)
    doc.circle(cx - 2.4, cy + 1.1, 1.15, 'S')
    doc.circle(cx + 2.4, cy + 1.1, 1.15, 'S')
    return
  }

  if (kind === 'beef') {
    doc.circle(cx - 0.2, cy - 0.2, 2.3, 'S')
    doc.circle(cx - 2.4, cy - 2.1, 0.85, 'S')
    doc.circle(cx + 2.0, cy - 2.1, 0.85, 'S')
    doc.line(cx - 1.1, cy + 0.4, cx - 1.1, cy + 0.9)
    doc.line(cx + 0.7, cy + 0.4, cx + 0.7, cy + 0.9)
    return
  }

  if (kind === 'calendar') {
    doc.roundedRect(cx - 3.1, cy - 2.2, 6.2, 5.2, 0.6, 0.6, 'S')
    doc.line(cx - 3.1, cy - 0.5, cx + 3.1, cy - 0.5)
    doc.line(cx - 1.4, cy - 3.1, cx - 1.4, cy - 1.4)
    doc.line(cx + 1.4, cy - 3.1, cx + 1.4, cy - 1.4)
    doc.setFillColor(87, 83, 78)
    doc.circle(cx - 1.3, cy + 1.1, 0.35, 'F')
    doc.circle(cx, cy + 1.1, 0.35, 'F')
    doc.circle(cx + 1.3, cy + 1.1, 0.35, 'F')
    return
  }

  doc.line(cx - 3.3, cy, cx - 1.8, cy)
  doc.line(cx - 1.8, cy, cx - 0.7, cy - 2.2)
  doc.line(cx - 0.7, cy - 2.2, cx + 0.6, cy + 2.2)
  doc.line(cx + 0.6, cy + 2.2, cx + 1.8, cy)
  doc.line(cx + 1.8, cy, cx + 3.3, cy)
}

function drawMetricCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  changePct: number | null,
  icon: MetricIcon,
) {
  const cx = x + width / 2
  doc.setFillColor(244, 244, 245)
  doc.circle(cx, y + 8, 5.8, 'F')
  drawMetricIcon(doc, icon, cx, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 113, 108)
  doc.text(label, cx, y + 18, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(28, 25, 23)
  const valueWidth = doc.getTextWidth(value)
  const badgeX = cx + valueWidth / 2 + 2
  doc.text(value, cx, y + 28, { align: 'center' })
  drawChangeBadge(doc, badgeX, y + 23.2, changePct)
}

function addWeeklyVisual(doc: jsPDF, farmName: string, weekly: WeeklyReport) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(27, 93, 59)
  doc.rect(0, 0, pageWidth, 34, 'F')
  doc.setTextColor(220, 237, 226)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('REPORTE SEMANAL', pageWidth / 2, 11, { align: 'center' })
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.text(farmName.toUpperCase(), pageWidth / 2, 20, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220, 237, 226)
  doc.text(`Semana del ${formatDayLong(weekly.thisSaturday)}`, pageWidth / 2, 27, {
    align: 'center',
  })

  const col = (pageWidth - 28) / 2
  drawMetricCard(doc, 14, 40, col, 'Peso total', kgLabel(weekly.totalWeight, 0), weekly.totalWeightChangePct, 'scale')
  drawMetricCard(doc, 14 + col, 40, col, 'Peso promedio', kgLabel(weekly.averageWeight, 0), weekly.averageWeightChangePct, 'beef')
  drawMetricCard(doc, 14, 76, col, 'Gan. diaria total', kgLabel(weekly.totalDailyGain, 2), weekly.dailyGainChangePct, 'calendar')
  drawMetricCard(doc, 14 + col, 76, col, 'Gan. diaria prom.', kgLabel(weekly.averageDailyGain, 3), weekly.dailyGainChangePct, 'activity')

  doc.setDrawColor(27, 93, 59)
  doc.setLineWidth(0.7)
  doc.line(28, 114, pageWidth - 28, 114)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(27, 93, 59)
  doc.text('Estructura del hato', pageWidth / 2, 123, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(168, 162, 158)
  doc.text(
    `GMD esperada ${EXPECTED_GMD_KG.toFixed(2)} kg/dia · baja ganancia < ${LOW_GMD_KG.toFixed(2)} kg/dia`,
    pageWidth / 2,
    129,
    { align: 'center' },
  )

  const structure = [
    ['Total de animales', String(weekly.herdTotal)],
    ['Sobre ganancia esperada', String(weekly.overExpectedGain)],
    ['Sobre peso promedio', String(weekly.overAverageWeight)],
    ['Por debajo del promedio', String(weekly.belowAverageWeight)],
    ['Con baja ganancia', String(weekly.lowGain)],
  ]
  autoTable(doc, {
    startY: 134,
    body: structure,
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: { top: 2.4, bottom: 2.4, left: 2, right: 2 }, textColor: [68, 64, 60] },
    columnStyles: {
      0: { cellWidth: 130, fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' },
    },
    margin: { left: 22, right: 22 },
  })

  let y = lastTableY(doc) + 8
  y = addHeading(doc, y, 'Pesaje de la semana')
  y = addNote(
    doc,
    y,
    `Ultimo peso, diferencia vs la semana pasada y GMD semanal · ${formatDayLong(weekly.thisSaturday)}`,
  )
  return addTable(
    doc,
    y,
    ['Animal', 'Ultimo peso', 'Dif. semanal', 'GMD semanal'],
    [
      ...(weekly.bulls.length === 0
        ? [['No hay bovinos activos.', '', '', '']]
        : weekly.bulls.map((item) => [
            bovineLabel(item.bovine),
            item.lastWeight == null ? '—' : item.lastWeight.toFixed(0),
            formatSigned(item.weekDelta, 0),
            item.weeklyGmd == null ? '—' : item.weeklyGmd.toFixed(2),
          ])),
      [
        'Totales',
        weekly.totalWeight == null ? '—' : weekly.totalWeight.toFixed(0),
        formatSigned(weekly.totalWeightGained, 0),
        weekly.averageDailyGain == null ? '—' : weekly.averageDailyGain.toFixed(2),
      ],
    ],
  )
}

export function buildWeeklyReportPdf(data: {
  farmName: string
  bovines: ReportData['bovines']
  weighings: ReportData['weighings']
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const weekly = buildWeeklyReport(data.bovines, data.weighings)
  addWeeklyVisual(doc, data.farmName, weekly)
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(168, 162, 158)
    doc.text(
      `Documento generado desde BoviTrack · ${page}/${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 10,
    )
  }
  return {
    blob: doc.output('blob') as Blob,
    filename: suggestedWeeklyFilename(data.farmName, weekly.thisSaturday),
  }
}

export function buildReportPdf(data: ReportData, selection: ReportSelection) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const metrics = computeMetrics(data.bovines, data.weighings, data.treatments)
  const weekly = buildWeeklyReport(data.bovines, data.weighings)
  const hints = saleHints(data.bovines, data.weighings)
  const byBovine = new Map(data.bovines.map((item) => [item.id, item]))
  const pageWidth = doc.internal.pageSize.getWidth()
  const hasOthers = REPORT_SECTIONS.some(
    (section) => section.id !== 'semanal' && selection[section.id],
  )

  if (selection.semanal) {
    addWeeklyVisual(doc, data.farmName, weekly)
    if (hasOthers) doc.addPage()
  }

  let y = 16
  if (hasOthers) {
    doc.setTextColor(27, 93, 59)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('BOVITRACK · GANADERÍA Y CAMPO', 14, y)
    y += 8
    doc.setTextColor(28, 25, 23)
    doc.setFontSize(18)
    doc.text(`Reporte de ${data.farmName}`, 14, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(120, 113, 108)
    const meta = [
      data.farmLocation,
      `Generado el ${formatDateTime(data.generatedAt)}`,
    ]
      .filter(Boolean)
      .join(' · ')
    doc.text(meta, 14, y)
    y += 4
    doc.setDrawColor(27, 93, 59)
    doc.setLineWidth(0.6)
    doc.line(14, y, pageWidth - 14, y)
    y += 10
  }

  if (selection.resumen) {
    y = addHeading(doc, y, 'Resumen de la finca')
    y = addTable(
      doc,
      y,
      ['Indicador', 'Valor'],
      [
        ['Toros activos', String(metrics.activeBulls)],
        ['GMD global', metrics.averageGmd == null ? '—' : `${metrics.averageGmd.toFixed(2)} kg`],
        ['GMD semanal', metrics.weeklyGmd == null ? '—' : `${metrics.weeklyGmd.toFixed(2)} kg`],
        ['Alertas pendientes', String(metrics.pendingAlerts)],
      ],
    )
  }

  if (selection.toros) {
    y = addHeading(doc, y, 'Inventario de toros')
    y = addTable(
      doc,
      y,
      ['Identificador', 'DIIO', 'Nombre', 'Sexo / raza', 'Estado'],
      data.bovines.length === 0
        ? [['No hay bovinos registrados en esta finca.', '', '', '', '']]
        : data.bovines.map((item) => [
            item.identificador_interno,
            item.numero_diio ?? '—',
            item.nombre ?? '—',
            `${item.sexo === 'MACHO' ? 'Macho' : 'Hembra'}${item.raza ? ` · ${item.raza}` : ''}`,
            statusLabel(item.estado),
          ]),
    )
  }

  if (selection.pesajes) {
    y = addHeading(doc, y, 'Historial de pesajes')
    y = addTable(
      doc,
      y,
      ['Bovino', 'Fecha', 'Peso'],
      data.weighings.length === 0
        ? [['No hay pesajes registrados.', '', '']]
        : [...data.weighings].reverse().map((item) => {
            const bovine = byBovine.get(item.bovino_id)
            return [
              bovine ? bovineLabel(bovine) : 'Bovino',
              formatDate(item.fecha_pesaje),
              `${item.peso_kg.toFixed(1)} kg`,
            ]
          }),
    )
  }

  if (selection.inventario) {
    y = addHeading(doc, y, 'Inventario de bodega')
    y = addTable(
      doc,
      y,
      ['Insumo', 'Categoría', 'Cantidad', 'Ubicación'],
      [['Aún no hay movimientos de bodega registrados.', '', '', '']],
    )
  }

  if (selection.tratamientos) {
    y = addHeading(doc, y, 'Tratamientos y alertas')
    y = addTable(
      doc,
      y,
      ['Bovino', 'Próxima aplicación', 'Detalle'],
      data.treatments.length === 0
        ? [['No hay tratamientos programados.', '', '']]
        : data.treatments.map((item) => {
            const bovine = item.bovino ?? byBovine.get(item.bovino_id)
            return [
              bovine ? bovineLabel(bovine) : 'Bovino',
              item.proxima_aplicacion ? formatDate(item.proxima_aplicacion) : '—',
              item.observaciones ?? 'Aplicación programada',
            ]
          }),
    )
  }

  if (selection.venta) {
    y = addHeading(doc, y, 'Evaluación de venta')
    y = addTable(
      doc,
      y,
      ['Bovino', 'Recomendación', 'Detalle'],
      hints.length === 0
        ? [['Agrega bovinos y pesajes para evaluar ventas.', '', '']]
        : hints.map((hint) => [
            bovineLabel(hint.bovine),
            saleLabel(hint.status),
            hint.detail,
          ]),
    )
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(168, 162, 158)
    doc.text(
      `Documento generado desde BoviTrack · ${page}/${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 10,
    )
  }

  return doc.output('blob') as Blob
}

function isAbortError(cause: unknown) {
  return cause instanceof DOMException && cause.name === 'AbortError'
}

export async function saveReportPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export { isAbortError }
