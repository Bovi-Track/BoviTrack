import { HistoryItem } from './SanitaryHistoryItem.tsx'
import { kinds, kindById, planStatusLabel, planStatusClass } from './sanitary-options.ts'
import { latestOf, planStatus } from '../../lib/sanitary.ts'
import { bovineStatusLabel, bovineLabel } from '../../lib/bovines.ts'
import { WeightHistory } from './WeightHistory.tsx'
import { SegmentButton } from '../dashboard/SegmentButton.tsx'
import { formatDayLong as formatIso } from '../../lib/dates.ts'
import type { SanitaryKind, SanitaryRecord } from '../../types/sanitary.ts'
import { ChevronLeft, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Bovine, Weighing } from '../../types/dashboard.ts'

// RF-UC02-01 (parcial), RF-UC06-02 y RF-UC07-01: presenta la ficha, pesajes y sanidad del toro.
export function BullSanitaryDetail({
  bovine,
  weighings,
  records,
  kindFilter,
  onKindFilter,
  onBack,
  onEdit,
  onRegister,
  onRemove,
}: {
  bovine: Bovine
  weighings: Weighing[]
  records: SanitaryRecord[]
  kindFilter: SanitaryKind | 'TODOS'
  onKindFilter: (value: SanitaryKind | 'TODOS') => void
  onBack: () => void
  onEdit: () => void
  onRegister: (tipo: SanitaryKind) => void
  onRemove: (id: string) => void
}) {
  const [fichaView, setFichaView] = useState<'sanidad' | 'peso'>('peso')
  const history = [...records]
    .filter((item) => kindFilter === 'TODOS' || item.tipo === kindFilter)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-medium text-stone-500 hover:text-bovi"
      >
        <ChevronLeft className="size-4" />
        Volver al hato
      </button>

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
            FICHA
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            {bovineLabel(bovine)}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {bovine.numero_diio ? `DIIO ${bovine.numero_diio}` : 'Sin DIIO'}
            {bovine.raza ? ` · ${bovine.raza}` : ''}
            {bovine.color ? ` · ${bovine.color}` : ''}
            {` · ${bovine.sexo === 'MACHO' ? 'Macho' : 'Hembra'}`}
            {` · ${bovineStatusLabel(bovine.estado)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-800 transition hover:bg-cream"
        >
          <Pencil className="size-4 text-bovi" />
          Editar
        </button>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-stone-200/60 p-1">
        <SegmentButton
          active={fichaView === 'peso'}
          onClick={() => setFichaView('peso')}
          label="Pesajes"
        />
        <SegmentButton
          active={fichaView === 'sanidad'}
          onClick={() => setFichaView('sanidad')}
          label="Sanidad"
        />
      </div>

      {fichaView === 'peso' ? (
        <WeightHistory weighings={weighings} />
      ) : (
        <>
          <div className="mb-5 flex justify-end">
            <button
              type="button"
              onClick={() => onRegister(kindFilter === 'TODOS' ? 'VACUNACION' : kindFilter)}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover"
            >
              <Plus className="size-4" />
              Aplicar
            </button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2">
            {kinds.map((kind) => {
              const latest = latestOf(records, kind.id)
              const status = planStatus(latest)
              const Icon = kind.icon
              const selectedKind = kindFilter === kind.id
              return (
                <button
                  key={kind.id}
                  type="button"
                  onClick={() => onKindFilter(selectedKind ? 'TODOS' : kind.id)}
                  className={`cursor-pointer rounded-2xl border bg-white p-3 text-left shadow-sm ${selectedKind ? 'border-bovi' : 'border-stone-200/80'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-full p-1.5 ${kind.chip}`}>
                      <Icon className="size-3.5" />
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${planStatusClass[status]}`}
                    >
                      {planStatusLabel[status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-stone-900">{kind.short}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {latest
                      ? `${latest.producto} · ${formatIso(latest.fecha)}`
                      : 'Sin aplicaciones'}
                  </p>
                  {latest?.proxima ? (
                    <p className="mt-1 text-xs font-medium text-stone-700">
                      Próxima {formatIso(latest.proxima)}
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold text-stone-900">
                Historial
              </h2>
              {kindFilter !== 'TODOS' ? (
                <button
                  type="button"
                  onClick={() => onKindFilter('TODOS')}
                  className="cursor-pointer text-xs font-medium text-bovi"
                >
                  Ver todos
                </button>
              ) : null}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-stone-500">
                {kindFilter === 'TODOS'
                  ? 'Todavía no hay aplicaciones. Usa Aplicar para registrar la primera.'
                  : `No hay ${kindById[kindFilter].label.toLowerCase()} en esta sesión.`}
              </p>
            ) : (
              <ol className="space-y-4">
                {history.map((item) => (
                  <HistoryItem key={item.id} item={item} onRemove={onRemove} />
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  )
}
