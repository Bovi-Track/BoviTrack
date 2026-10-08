import {
  Activity,
  Beef,
  CalendarDays,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { bovineLabel } from '../../lib/dashboard.ts'
import {
  EXPECTED_GMD_KG,
  LOW_GMD_KG,
  formatPct,
  formatSigned,
  type WeeklyReport,
} from '../../lib/gmd.ts'

function formatDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ChangeBadge({ value }: { value: number | null }) {
  const change = formatPct(value)
  if (!change) {
    return (
      <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-400">
        vs sem. ant.
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[12px] font-semibold ${
        change.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
      }`}
    >
      {change.up ? (
        <TrendingUp className="size-3.5" />
      ) : (
        <TrendingDown className="size-3.5" />
      )}
      {change.text}
    </span>
  )
}

function StatTile({
  icon,
  label,
  value,
  change,
}: {
  icon: ReactNode
  label: string
  value: string
  change: number | null
}) {
  return (
    <article className="px-2 py-4 text-center">
      <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-stone-100 text-stone-600 shadow-sm ring-1 ring-stone-200/70">
        {icon}
      </div>
      <p className="text-[13px] font-medium text-stone-500">{label}</p>
      <div className="mt-1 flex items-center justify-center gap-2">
        <p className="text-[28px] font-bold leading-none tracking-tight text-stone-900">
          {value}
        </p>
        <ChangeBadge value={change} />
      </div>
    </article>
  )
}

function StructureRow({ label, value }: { label: string; value: string | number }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3 text-[15px]">
      <span className="text-stone-700">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-stone-900">{value}</span>
    </li>
  )
}

function kg(value: number | null, digits: number) {
  if (value == null) return '—'
  return `${value.toFixed(digits)} Kg`
}

export function WeeklyReportCard({
  farmName,
  report,
}: {
  farmName: string
  report: WeeklyReport
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm">
      <header className="bg-bovi px-5 py-5 text-center text-white">
        <p className="text-[11px] font-medium tracking-[0.2em] text-white/70">
          REPORTE SEMANAL
        </p>
        <h2 className="mt-1 text-xl font-semibold uppercase tracking-wide">
          {farmName}
        </h2>
        <p className="mt-1 text-xs text-white/75">
          Semana del {formatDay(report.thisSaturday)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-3 pb-2 pt-5">
        <StatTile
          icon={<Scale className="size-7" />}
          label="Peso total"
          value={kg(report.totalWeight, 0)}
          change={report.totalWeightChangePct}
        />
        <StatTile
          icon={<Beef className="size-7" />}
          label="Peso promedio"
          value={kg(report.averageWeight, 0)}
          change={report.averageWeightChangePct}
        />
        <StatTile
          icon={<CalendarDays className="size-7" />}
          label="Gan. diaria total"
          value={kg(report.totalDailyGain, 2)}
          change={report.dailyGainChangePct}
        />
        <StatTile
          icon={<Activity className="size-7" />}
          label="Gan. diaria prom."
          value={kg(report.averageDailyGain, 3)}
          change={report.dailyGainChangePct}
        />
      </div>

      <div className="mx-8 border-t-2 border-bovi/70" />

      <div className="px-6 py-5">
        <h3 className="mb-1 text-center text-xl font-medium text-bovi">
          Estructura del hato
        </h3>
        <p className="mb-2 text-center text-[11px] text-stone-400">
          GMD esperada {EXPECTED_GMD_KG.toFixed(2)} kg/día · baja ganancia &lt;{' '}
          {LOW_GMD_KG.toFixed(2)} kg/día
        </p>
        <ul>
          <StructureRow label="Total de animales" value={report.herdTotal} />
          <StructureRow
            label="Sobre ganancia esperada"
            value={report.overExpectedGain}
          />
          <StructureRow
            label="Sobre peso promedio"
            value={report.overAverageWeight}
          />
          <StructureRow
            label="Por debajo del promedio"
            value={report.belowAverageWeight}
          />
          <StructureRow label="Con baja ganancia" value={report.lowGain} />
        </ul>
      </div>

      <div className="border-t border-stone-100 px-4 py-4">
        <h3 className="mb-1 font-serif text-lg font-semibold text-stone-900">
          Pesaje de la semana
        </h3>
        <p className="mb-3 text-xs text-stone-500">
          Último peso, kilos ganados o perdidos vs la semana pasada y GMD
          semanal.
        </p>
        {report.bulls.length === 0 ? (
          <p className="text-sm text-stone-400">No hay bovinos activos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="bg-bovi text-left text-[11px] font-semibold uppercase tracking-wide text-white">
                  <th className="px-2 py-2">Animal</th>
                  <th className="px-2 py-2 text-right">
                    Último peso
                    <span className="block font-normal normal-case tracking-normal text-white/70">
                      {formatDay(report.thisSaturday)}
                    </span>
                  </th>
                  <th className="px-2 py-2 text-right">Dif. semanal</th>
                  <th className="px-2 py-2 text-right">GMD semanal</th>
                </tr>
              </thead>
              <tbody>
                {report.bulls.map((item) => {
                  const deltaTone =
                    item.weekDelta == null
                      ? 'text-stone-400'
                      : item.weekDelta < 0
                        ? 'text-rose-700'
                        : 'text-stone-900'
                  const gmdTone =
                    item.weeklyGmd == null
                      ? 'text-stone-400'
                      : item.weeklyGmd < 0
                        ? 'text-rose-700'
                        : item.weeklyGmd < LOW_GMD_KG
                          ? 'text-amber-700'
                          : 'text-bovi'
                  return (
                    <tr
                      key={item.bovine.id}
                      className="border-b border-stone-100 last:border-0"
                    >
                      <td className="px-2 py-2 font-medium text-stone-900">
                        {bovineLabel(item.bovine)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {item.lastWeight == null
                          ? '—'
                          : item.lastWeight.toFixed(0)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums font-medium ${deltaTone}`}
                      >
                        {formatSigned(item.weekDelta, 0)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums font-semibold ${gmdTone}`}
                      >
                        {item.weeklyGmd == null
                          ? '—'
                          : item.weeklyGmd.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-emerald-50 font-semibold text-stone-900">
                  <td className="px-2 py-2">Totales</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {report.totalWeight == null
                      ? '—'
                      : report.totalWeight.toFixed(0)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatSigned(report.totalWeightGained, 0)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {report.averageDailyGain == null
                      ? '—'
                      : report.averageDailyGain.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <ul className="mt-4 divide-y divide-stone-100 text-sm">
          <StructureRow
            label="Peso total"
            value={Math.round(report.totalWeight ?? 0)}
          />
          <StructureRow
            label="Peso prom. x animal"
            value={Math.round(report.averageWeight ?? 0)}
          />
          <StructureRow
            label="Total peso ganado"
            value={formatSigned(report.totalWeightGained, 0)}
          />
          <StructureRow
            label="Total ganancia diaria"
            value={
              report.totalDailyGain == null
                ? '—'
                : report.totalDailyGain.toFixed(2)
            }
          />
          <StructureRow
            label="Ganancia diaria x animal"
            value={
              report.averageDailyGain == null
                ? '—'
                : report.averageDailyGain.toFixed(2)
            }
          />
        </ul>
      </div>
    </section>
  )
}
