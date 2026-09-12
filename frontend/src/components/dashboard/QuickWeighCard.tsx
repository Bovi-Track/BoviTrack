import { Plus, ScanLine } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { bovineLabel, todayIso } from '../../lib/dashboard.ts'
import type { Bovine } from '../../types/dashboard.ts'
import { fieldClass } from './Modal.tsx'

type QuickWeighCardProps = {
  bovines: Bovine[]
  disabled?: boolean
  onAddBovine: () => void
  onSave: (payload: {
    bovino_id: string
    peso_kg: number
    fecha_pesaje: string
  }) => Promise<void>
}

export function QuickWeighCard({
  bovines,
  disabled,
  onAddBovine,
  onSave,
}: QuickWeighCardProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    const pool = bovines.filter((item) => item.estado === 'ACTIVO')
    if (!term) return pool.slice(0, 6)
    return pool
      .filter((item) =>
        [item.numero_diio, item.identificador_interno, item.nombre ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 6)
  }, [bovines, query])

  const selected = bovines.find((item) => item.id === selectedId) ?? null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) {
      setError('Selecciona un bovino por DIIO o identificador.')
      return
    }
    const peso = Number(weight)
    if (!Number.isFinite(peso) || peso <= 0) {
      setError('Ingresa un peso válido en kg.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSave({
        bovino_id: selectedId,
        peso_kg: peso,
        fecha_pesaje: date,
      })
      setWeight('')
      setQuery('')
      setSelectedId('')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo guardar el pesaje.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onAddBovine}
          disabled={disabled}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="size-4" strokeWidth={2} />
          Agregar bovino
        </button>
        <p className="max-w-40 text-right text-xs text-stone-400">
          Captura rápida en campo
        </p>
      </div>

      <h2 className="font-serif text-2xl font-semibold text-stone-900">
        Pesaje rápido
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        Busca el DIIO o identificador, anota el peso y guarda.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="bull-search" className="text-sm font-medium text-stone-800">
            ID de toro / DIIO-SENASA
          </label>
          <div className="relative">
            <ScanLine className="pointer-events-none absolute top-3.5 left-3 size-4 text-stone-400" />
            <input
              id="bull-search"
              value={query}
              disabled={disabled}
              onChange={(event) => {
                setQuery(event.target.value)
                setError('')
              }}
              className={`${fieldClass} pl-10`}
              placeholder="Buscar código"
            />
          </div>
          {selected ? (
            <p className="rounded-xl bg-bovi/8 px-3 py-2 text-sm font-medium text-bovi">
              Seleccionado: {bovineLabel(selected)}
            </p>
          ) : null}
          {matches.length > 0 ? (
            <ul className="overflow-hidden rounded-2xl border border-stone-200 bg-cream">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id)
                      setQuery(item.identificador_interno)
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between px-3 py-3 text-left text-sm ${
                      selectedId === item.id
                        ? 'bg-bovi text-white'
                        : 'text-stone-700 hover:bg-white'
                    }`}
                  >
                    <span>{bovineLabel(item)}</span>
                    <span className="text-xs opacity-80">{item.numero_diio}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-400">
              No hay bovinos activos. Agrega uno para pesar.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="peso" className="text-sm font-medium text-stone-800">
              Peso actual (kg)
            </label>
            <input
              id="peso"
              type="number"
              inputMode="decimal"
              min={1}
              step="0.1"
              required
              disabled={disabled}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className={`${fieldClass} font-serif text-2xl font-semibold`}
              placeholder="0.0"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fecha-pesaje" className="text-sm font-medium text-stone-800">
              Fecha
            </label>
            <input
              id="fecha-pesaje"
              type="date"
              required
              disabled={disabled}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={disabled || submitting}
          className="min-h-14 w-full cursor-pointer rounded-2xl bg-bovi text-base font-semibold text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : 'Guardar pesaje'}
        </button>
      </form>
    </section>
  )
}
