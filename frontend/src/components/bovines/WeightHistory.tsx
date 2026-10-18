import { daysBetween, formatDayLong as formatIso } from '../../lib/dates.ts'
import { bovineGmd } from '../../lib/gmd.ts'
import type { Weighing } from '../../types/dashboard.ts'

// RF-UC06-02: presenta pesajes, curva de peso e indicadores de GMD del toro.
export function WeightHistory({ weighings }: { weighings: Weighing[] }) {
  const sorted = [...weighings].sort((a, b) =>
    a.fecha_pesaje.localeCompare(b.fecha_pesaje) || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
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
              {gmd.lifetime == null ? '—' : `${gmd.lifetime.toFixed(2)} kg/día`}
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
              {gmd.weekly == null ? '—' : `${gmd.weekly.toFixed(2)} kg/día`}
            </p>
            <p className="text-[11px] text-stone-400">sábados o últimos dos pesajes disponibles</p>
          </div>
        </div>
        <WeightCurve points={sorted} />
      </section>

      <GmdCurve points={sorted} />

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

// Dibuja la curva ubicando cada pesaje según los días reales desde el primero.
function WeightCurve({ points }: { points: Weighing[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl bg-cream text-sm text-stone-400">
        Sin datos para graficar
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
  const firstDate = points[0].fecha_pesaje
  const lastDate = points[points.length - 1].fecha_pesaje
  const elapsedDays = daysBetween(firstDate, lastDate)
  const coords = points.map((item) => {
    const day = daysBetween(firstDate, item.fecha_pesaje)
    const x = elapsedDays > 0 ? left + (day / elapsedDays) * innerW : left + innerW / 2
    const y = top + ((yMax - item.peso_kg) / (yMax - yMin)) * innerH
    return { x, y, item, day }
  })
  const path = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Curva de peso con fechas e intervalos reales">
      <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#e7e5e4" />
      <line
        x1={left}
        y1={height - bottom}
        x2={width - right}
        y2={height - bottom}
        stroke="#e7e5e4"
      />
      {coords.slice(1).map((point, index) => {
        const previous = coords[index]
        const days = point.day - previous.day
        return days > 0 ? (
          <line key={`${previous.item.id}:${point.item.id}`} x1={previous.x} y1={height - bottom - 1}
            x2={point.x} y2={height - bottom - 1} stroke="#a8a29e" strokeWidth="2">
            <title>{days} {days === 1 ? 'día' : 'días'} entre pesajes</title>
          </line>
        ) : null
      })}
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
        >
          <title>{`${formatIso(point.item.fecha_pesaje)}: ${point.item.peso_kg.toFixed(1)} kg`}</title>
        </circle>
      ))}
      {points.length === 1 || elapsedDays === 0 ? (
        <text x={width / 2} y={height - 6} className="fill-stone-400" fontSize="9" textAnchor="middle">
          {formatIso(firstDate)}
        </text>
      ) : <>
        <text x={left} y={height - 6} className="fill-stone-400" fontSize="9" textAnchor="start">
          {formatIso(firstDate, false)}
        </text>
        <text x={width - right} y={height - 6} className="fill-stone-400" fontSize="9" textAnchor="end">
          {formatIso(lastDate, false)}
        </text>
      </>}
    </svg>
  )
}

type GmdInterval = {
  first: Weighing
  last: Weighing
  days: number
  gmd: number
  midpoint: number
}

function gmdIntervals(points: Weighing[]): GmdInterval[] {
  return points.slice(1).flatMap((last, index) => {
    const first = points[index]
    const days = daysBetween(first.fecha_pesaje, last.fecha_pesaje)
    if (days <= 0) return []
    return [{
      first,
      last,
      days,
      gmd: (last.peso_kg - first.peso_kg) / days,
      midpoint: daysBetween(points[0].fecha_pesaje, first.fecha_pesaje) + days / 2,
    }]
  })
}

// RF-UC06-02: grafica la GMD entre pesajes consecutivos según los días reales transcurridos.
function GmdCurve({ points }: { points: Weighing[] }) {
  const intervals = gmdIntervals(points)
  if (intervals.length === 0) {
    return (
      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-stone-900">GMD por intervalo</h2>
        <p className="mt-2 text-sm text-stone-500">
          {points.length < 2
            ? 'Registra al menos dos pesajes para graficar la GMD.'
            : 'Los pesajes tienen la misma fecha; se necesitan días transcurridos para calcular la GMD.'}
        </p>
      </section>
    )
  }

  const values = intervals.map((interval) => interval.gmd)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const pad = Math.max(0.1, (max - min) * 0.15)
  const yMin = min - pad
  const yMax = max + pad
  const width = 320
  const height = 150
  const left = 42
  const right = 10
  const top = 16
  const bottom = 26
  const innerW = width - left - right
  const innerH = height - top - bottom
  const firstDate = points[0].fecha_pesaje
  const lastDate = points[points.length - 1].fecha_pesaje
  const totalDays = daysBetween(firstDate, lastDate)
  const coords = intervals.map((interval) => ({
    interval,
    x: left + (interval.midpoint / totalDays) * innerW,
    y: top + ((yMax - interval.gmd) / (yMax - yMin)) * innerH,
  }))
  const path = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')
  const zeroY = top + ((yMax - 0) / (yMax - yMin)) * innerH

  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="font-serif text-xl font-semibold text-stone-900">GMD por intervalo</h2>
        <p className="mt-1 text-sm text-stone-500">Variación de peso dividida entre los días reales de cada par consecutivo.</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Gráfica de GMD entre pesajes en kilogramos por día">
        <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#e7e5e4" />
        <line x1={left} y1={zeroY} x2={width - right} y2={zeroY} stroke="#a8a29e" strokeDasharray="3 3" />
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="#e7e5e4" />
        <text x={3} y={top + 8} className="fill-stone-400" fontSize="9">{yMax.toFixed(2)}</text>
        <text x={3} y={zeroY - 2} className="fill-stone-400" fontSize="9">0</text>
        <text x={3} y={height - bottom} className="fill-stone-400" fontSize="9">{yMin.toFixed(2)}</text>
        {coords.length > 1 ? <path d={path} fill="none" stroke="#b45309" strokeWidth="2" strokeLinejoin="round" /> : null}
        {coords.map(({ interval, x, y }) => (
          <circle key={`${interval.first.id}:${interval.last.id}`} cx={x} cy={y} r="4" fill="#b45309">
            <title>{`${interval.gmd.toFixed(2)} kg/día · ${interval.days} ${interval.days === 1 ? 'día' : 'días'} · ${formatIso(interval.first.fecha_pesaje)} a ${formatIso(interval.last.fecha_pesaje)}`}</title>
          </circle>
        ))}
        <text x={left} y={height - 6} className="fill-stone-400" fontSize="9" textAnchor="start">{formatIso(firstDate, false)}</text>
        <text x={width - right} y={height - 6} className="fill-stone-400" fontSize="9" textAnchor="end">{formatIso(lastDate, false)}</text>
      </svg>
      <p className="text-xs text-stone-500">GMD en kg/día; valores negativos indican pérdida de peso.</p>
    </section>
  )
}
