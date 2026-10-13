import { formatDayLong as formatIso } from '../../lib/dates.ts'
import { bovineGmd } from '../../lib/gmd.ts'
import type { Weighing } from '../../types/dashboard.ts'

// RF-UC06-02: presenta pesajes, curva de peso e indicadores de GMD del toro.
export function WeightHistory({ weighings }: { weighings: Weighing[] }) {
  const sorted = [...weighings].sort((a, b) =>
    a.fecha_pesaje.localeCompare(b.fecha_pesaje),
  )
  const latest = sorted[sorted.length - 1]
  const first = sorted[0]
  const gain =
    first && latest && sorted.length > 1 ? latest.peso_kg - first.peso_kg : null
  const gmd = bovineGmd(sorted)

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-stone-900">
              Curva de peso
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {latest
                ? `Último: ${latest.peso_kg.toFixed(1)} kg · ${formatIso(latest.fecha_pesaje)}`
                : 'Todavía no hay pesajes de este toro.'}
            </p>
          </div>
          {gain != null ? (
            <p className={`text-sm font-semibold ${gain >= 0 ? 'text-bovi' : 'text-red-700'}`}>
              {gain >= 0 ? '+' : ''}
              {gain.toFixed(1)} kg
            </p>
          ) : null}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-cream px-3 py-3">
            <p className="text-[11px] text-stone-500">GMD</p>
            <p className="font-serif text-xl font-semibold text-stone-900">
              {gmd.lifetime == null ? '—' : `${gmd.lifetime.toFixed(2)} kg`}
            </p>
            <p className="text-[11px] text-stone-400">primer a último pesaje</p>
          </div>
          <div className="rounded-2xl bg-cream px-3 py-3">
            <p className="text-[11px] text-stone-500">GMD semanal</p>
            <p
              className={`font-serif text-xl font-semibold ${
                gmd.weekly == null
                  ? 'text-stone-900'
                  : gmd.weekly < 0
                    ? 'text-red-700'
                    : 'text-bovi'
              }`}
            >
              {gmd.weekly == null ? '—' : `${gmd.weekly.toFixed(2)} kg`}
            </p>
            <p className="text-[11px] text-stone-400">sábados o últimos dos pesajes</p>
          </div>
        </div>
        <WeightCurve points={sorted} />
      </section>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-serif text-xl font-semibold text-stone-900">
          Historial
        </h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-stone-500">
            Registra pesajes en esta pantalla o con el pesaje rápido de Inicio.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...sorted].reverse().map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-3"
              >
                <span className="text-sm text-stone-600">
                  {formatIso(item.fecha_pesaje)}
                </span>
                <span className="font-serif text-xl font-semibold text-stone-900">
                  {item.peso_kg.toFixed(1)}
                  <span className="ml-1 font-sans text-xs font-medium text-stone-400">
                    kg
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// Dibuja la curva de pesajes conservando el eje por índice actual, pendiente de fechas reales.
function WeightCurve({ points }: { points: Weighing[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl bg-cream text-sm text-stone-400">
        Sin datos para graficar
      </div>
    )
  }

  if (points.length === 1) {
    return (
      <div className="flex h-36 flex-col items-center justify-center rounded-2xl bg-cream">
        <p className="font-serif text-3xl font-semibold text-stone-900">
          {points[0].peso_kg.toFixed(1)} kg
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Se necesita otro pesaje para ver la curva
        </p>
      </div>
    )
  }

  const weights = points.map((item) => item.peso_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const pad = Math.max(1, (max - min) * 0.2)
  const yMin = min - pad
  const yMax = max + pad
  const width = 320
  const height = 140
  const left = 36
  const right = 10
  const top = 12
  const bottom = 24
  const innerW = width - left - right
  const innerH = height - top - bottom
  const coords = points.map((item, index) => {
    const x = left + (index / (points.length - 1)) * innerW
    const y = top + ((yMax - item.peso_kg) / (yMax - yMin)) * innerH
    return { x, y, item }
  })
  const path = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Curva de pesajes">
      <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#e7e5e4" />
      <line
        x1={left}
        y1={height - bottom}
        x2={width - right}
        y2={height - bottom}
        stroke="#e7e5e4"
      />
      <text x={4} y={top + 8} className="fill-stone-400" fontSize="9">
        {yMax.toFixed(0)}
      </text>
      <text x={4} y={height - bottom} className="fill-stone-400" fontSize="9">
        {yMin.toFixed(0)}
      </text>
      <path d={path} fill="none" stroke="#1b5d3b" strokeWidth="2.5" strokeLinejoin="round" />
      {coords.map((point) => (
        <circle
          key={point.item.id}
          cx={point.x}
          cy={point.y}
          r="3.5"
          fill="#1b5d3b"
        />
      ))}
      <text
        x={coords[0].x}
        y={height - 6}
        className="fill-stone-400"
        fontSize="9"
        textAnchor="start"
      >
        {formatIso(coords[0].item.fecha_pesaje)}
      </text>
      <text
        x={coords[coords.length - 1].x}
        y={height - 6}
        className="fill-stone-400"
        fontSize="9"
        textAnchor="end"
      >
        {formatIso(coords[coords.length - 1].item.fecha_pesaje)}
      </text>
    </svg>
  )
}
