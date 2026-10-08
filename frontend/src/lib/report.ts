import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { bovineLabel, computeMetrics, saleHints } from './dashboard.ts'
import {
  EXPECTED_GMD_KG,
  buildWeeklyReport,
  formatPct,
  formatSigned,
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

function kgText(value: number | null, digits: number) {
  return value == null ? '—' : `${value.toFixed(digits)} kg`
}

function changeText(value: number | null) {
  const change = formatPct(value)
  return change ? ` ${change.text}` : ''
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

export function suggestedReportFilename(farmName: string, generatedAt: string) {
  const date = generatedAt.slice(0, 10)
  const safe = farmName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
  return `BoviTrack-${safe || 'finca'}-${date}.pdf`
}

export function buildReportPdf(data: ReportData, selection: ReportSelection) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const metrics = computeMetrics(data.bovines, data.weighings, data.treatments)
  const weekly = buildWeeklyReport(data.bovines, data.weighings)
  const hints = saleHints(data.bovines, data.weighings)
  const byBovine = new Map(data.bovines.map((item) => [item.id, item]))
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 16
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

  if (selection.semanal) {
    y = addHeading(doc, y, 'Reporte semanal')
    y = addNote(
      doc,
      y,
      `Semana del ${formatDate(weekly.thisSaturday)} · GMD esperada ${EXPECTED_GMD_KG.toFixed(2)} kg/día`,
    )
    y = addTable(
      doc,
      y,
      ['Indicador', 'Valor'],
      [
        ['Peso total', `${kgText(weekly.totalWeight, 0)}${changeText(weekly.totalWeightChangePct)}`],
        ['Peso promedio', `${kgText(weekly.averageWeight, 0)}${changeText(weekly.averageWeightChangePct)}`],
        ['Gan. diaria total', `${kgText(weekly.totalDailyGain, 2)}${changeText(weekly.dailyGainChangePct)}`],
        ['Gan. diaria prom.', `${kgText(weekly.averageDailyGain, 3)}${changeText(weekly.dailyGainChangePct)}`],
        ['Total de animales', String(weekly.herdTotal)],
        ['Sobre ganancia esperada', String(weekly.overExpectedGain)],
        ['Sobre peso promedio', String(weekly.overAverageWeight)],
        ['Por debajo del promedio', String(weekly.belowAverageWeight)],
        ['Con baja ganancia', String(weekly.lowGain)],
      ],
    )
    y = addNote(
      doc,
      y,
      `Pesaje de la semana (${formatDate(weekly.thisSaturday)}): último peso, diferencia vs la semana pasada y GMD semanal.`,
    )
    y = addTable(
      doc,
      y,
      ['Animal', 'Último peso', 'Dif. semanal', 'GMD semanal'],
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
          weekly.averageDailyGain == null
            ? '—'
            : weekly.averageDailyGain.toFixed(2),
        ],
      ],
    )
    y = addTable(
      doc,
      y,
      ['Resumen semanal', 'Valor'],
      [
        ['Peso total', weekly.totalWeight == null ? '—' : weekly.totalWeight.toFixed(0)],
        [
          'Peso prom. x animal',
          weekly.averageWeight == null ? '—' : weekly.averageWeight.toFixed(0),
        ],
        ['Total peso ganado', formatSigned(weekly.totalWeightGained, 0)],
        [
          'Total ganancia diaria',
          weekly.totalDailyGain == null ? '—' : weekly.totalDailyGain.toFixed(2),
        ],
        [
          'Ganancia diaria x animal',
          weekly.averageDailyGain == null
            ? '—'
            : weekly.averageDailyGain.toFixed(2),
        ],
      ],
    )
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
