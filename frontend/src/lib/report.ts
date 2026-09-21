import { bovineLabel, computeMetrics, saleHints } from './dashboard.ts'
import type { Bovine, SaleHint, Treatment, Weighing } from '../types/dashboard.ts'

export type ReportSectionId =
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
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

function emptyRow(message: string, columns: number) {
  return `<tr><td colspan="${columns}" class="empty">${escapeHtml(message)}</td></tr>`
}

function table(headers: string[], rows: string) {
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

export function buildReportHtml(data: ReportData, selection: ReportSelection) {
  const metrics = computeMetrics(data.bovines, data.weighings, data.treatments)
  const hints = saleHints(data.bovines, data.weighings)
  const byBovine = new Map(data.bovines.map((item) => [item.id, item]))

  const sections: string[] = []

  if (selection.resumen) {
    sections.push(`
      <section>
        <h2>Resumen de la finca</h2>
        <div class="metrics">
          <article>
            <strong>${metrics.activeBulls}</strong>
            <span>Toros activos</span>
          </article>
          <article>
            <strong>${metrics.averageGmd == null ? '—' : `${metrics.averageGmd.toFixed(2)} kg`}</strong>
            <span>GMD global</span>
          </article>
          <article>
            <strong>${metrics.pendingAlerts}</strong>
            <span>Alertas pendientes</span>
          </article>
        </div>
      </section>
    `)
  }

  if (selection.toros) {
    const rows =
      data.bovines.length === 0
        ? emptyRow('No hay bovinos registrados en esta finca.', 5)
        : data.bovines
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.identificador_interno)}</td>
                  <td>${escapeHtml(item.numero_diio)}</td>
                  <td>${escapeHtml(item.nombre ?? '—')}</td>
                  <td>${item.sexo === 'MACHO' ? 'Macho' : 'Hembra'}${item.raza ? ` · ${escapeHtml(item.raza)}` : ''}</td>
                  <td>${statusLabel(item.estado)}</td>
                </tr>
              `,
            )
            .join('')
    sections.push(`
      <section>
        <h2>Inventario de toros</h2>
        ${table(['Identificador', 'DIIO', 'Nombre', 'Sexo / raza', 'Estado'], rows)}
      </section>
    `)
  }

  if (selection.pesajes) {
    const rows =
      data.weighings.length === 0
        ? emptyRow('No hay pesajes registrados.', 3)
        : [...data.weighings]
            .reverse()
            .map((item) => {
              const bovine = byBovine.get(item.bovino_id)
              return `
                <tr>
                  <td>${escapeHtml(bovine ? bovineLabel(bovine) : 'Bovino')}</td>
                  <td>${formatDate(item.fecha_pesaje)}</td>
                  <td>${item.peso_kg.toFixed(1)} kg</td>
                </tr>
              `
            })
            .join('')
    sections.push(`
      <section>
        <h2>Historial de pesajes</h2>
        ${table(['Bovino', 'Fecha', 'Peso'], rows)}
      </section>
    `)
  }

  if (selection.inventario) {
    sections.push(`
      <section>
        <h2>Inventario de bodega</h2>
        ${table(
          ['Insumo', 'Categoría', 'Cantidad', 'Ubicación'],
          emptyRow('Aún no hay movimientos de bodega registrados.', 4),
        )}
      </section>
    `)
  }

  if (selection.tratamientos) {
    const rows =
      data.treatments.length === 0
        ? emptyRow('No hay tratamientos programados.', 3)
        : data.treatments
            .map((item) => {
              const bovine = item.bovino ?? byBovine.get(item.bovino_id)
              return `
                <tr>
                  <td>${escapeHtml(bovine ? bovineLabel(bovine) : 'Bovino')}</td>
                  <td>${item.proxima_aplicacion ? formatDate(item.proxima_aplicacion) : '—'}</td>
                  <td>${escapeHtml(item.observaciones ?? 'Aplicación programada')}</td>
                </tr>
              `
            })
            .join('')
    sections.push(`
      <section>
        <h2>Tratamientos y alertas</h2>
        ${table(['Bovino', 'Próxima aplicación', 'Detalle'], rows)}
      </section>
    `)
  }

  if (selection.venta) {
    const rows =
      hints.length === 0
        ? emptyRow('Agrega bovinos y pesajes para evaluar ventas.', 3)
        : hints
            .map(
              (hint) => `
                <tr>
                  <td>${escapeHtml(bovineLabel(hint.bovine))}</td>
                  <td>${saleLabel(hint.status)}</td>
                  <td>${escapeHtml(hint.detail)}</td>
                </tr>
              `,
            )
            .join('')
    sections.push(`
      <section>
        <h2>Evaluación de venta</h2>
        ${table(['Bovino', 'Recomendación', 'Detalle'], rows)}
      </section>
    `)
  }

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Reporte BoviTrack · ${escapeHtml(data.farmName)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        font-family: "Source Sans 3", "Segoe UI", sans-serif;
        color: #44403c;
        background: #fff;
      }
      header { border-bottom: 2px solid #1b5d3b; padding-bottom: 16px; margin-bottom: 24px; }
      .brand { font-size: 12px; letter-spacing: 0.18em; color: #1b5d3b; font-weight: 600; }
      h1 { margin: 6px 0 4px; font-family: Fraunces, Georgia, serif; font-size: 28px; color: #1c1917; }
      .meta { margin: 0; font-size: 13px; color: #78716c; }
      h2 {
        margin: 0 0 12px;
        font-family: Fraunces, Georgia, serif;
        font-size: 20px;
        color: #1c1917;
      }
      section { margin-bottom: 28px; break-inside: avoid; }
      .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .metrics article {
        border: 1px solid #e7e5e4;
        border-radius: 12px;
        padding: 14px;
      }
      .metrics strong { display: block; font-size: 22px; color: #1c1917; }
      .metrics span { font-size: 12px; color: #78716c; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border-bottom: 1px solid #e7e5e4; text-align: left; padding: 8px 6px; }
      th { color: #1b5d3b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
      .empty { color: #a8a29e; font-style: italic; }
      footer { margin-top: 32px; font-size: 11px; color: #a8a29e; }
      @media print {
        body { padding: 0; }
        @page { margin: 16mm; }
      }
    </style>
  </head>
  <body>
    <header>
      <p class="brand">BOVITRACK · GANADERÍA & CAMPO</p>
      <h1>Reporte de ${escapeHtml(data.farmName)}</h1>
      <p class="meta">
        ${data.farmLocation ? `${escapeHtml(data.farmLocation)} · ` : ''}
        Generado el ${escapeHtml(formatDateTime(data.generatedAt))}
      </p>
    </header>
    ${sections.join('')}
    <footer>Documento generado desde BoviTrack. En el diálogo de impresión elige Guardar como PDF.</footer>
  </body>
</html>`
}

export function openReportPrintWindow(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    throw new Error('No se pudo preparar el reporte para imprimir.')
  }

  doc.open()
  doc.write(html)
  doc.close()

  window.setTimeout(() => {
    win.focus()
    win.print()
    window.setTimeout(() => frame.remove(), 2000)
  }, 350)
}
