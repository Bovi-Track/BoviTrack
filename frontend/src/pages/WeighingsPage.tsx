import { Plus, Scale, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { Field, Modal, fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import {
  bovineLabel,
  loadBovines,
  loadWeighings,
  readPendingWeighings,
  saveWeighing,
  todayIso,
  weighingErrorMessage,
  writePendingWeighings,
} from '../lib/dashboard.ts'
import type { Bovine, Weighing } from '../types/dashboard.ts'

type WeighingRow = Weighing & { bovine?: Bovine }

const emptyForm = {
  bovino_id: '',
  peso_kg: '',
  fecha_pesaje: todayIso(),
  observaciones: '',
}

export default function WeighingsPage() {
  const { user } = useAuth()
  const { activeFarm, loading } = useFarm()
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [rows, setRows] = useState<WeighingRow[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{
    message: string
    tone: 'ok' | 'warn' | 'error'
  } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!activeFarm) {
      setBovines([])
      setRows([])
      return
    }
    const farmId = activeFarm.id
    let active = true
    async function load() {
      try {
        const nextBovines = await loadBovines(farmId)
        const weighings = await loadWeighings(nextBovines.map((item) => item.id))
        if (!active) return
        const byId = new Map(nextBovines.map((item) => [item.id, item]))
        setBovines(nextBovines)
        setRows(
          [...weighings]
            .reverse()
            .map((item) => ({ ...item, bovine: byId.get(item.bovino_id) })),
        )
      } catch {
        if (active) {
          setToast({
            message: 'No se pudieron cargar los pesajes.',
            tone: 'error',
          })
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [activeFarm])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((item) => {
      const bovine = item.bovine
      const label = bovine
        ? `${bovine.nombre ?? ''} ${bovine.identificador_interno} ${bovine.numero_diio ?? ''}`
        : item.bovino_id
      return label.toLowerCase().includes(term)
    })
  }, [query, rows])

  function update(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function addRow(payload: Weighing) {
    const bovine = bovines.find((item) => item.id === payload.bovino_id)
    setRows((current) => [{ ...payload, bovine }, ...current])
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const peso = Number(form.peso_kg)
    if (!form.bovino_id) {
      setError('Selecciona un bovino.')
      return
    }
    if (!Number.isFinite(peso) || peso <= 0) {
      setError('Ingresa un peso válido en kg.')
      return
    }

    const payload = {
      bovino_id: form.bovino_id,
      peso_kg: peso,
      fecha_pesaje: form.fecha_pesaje,
    }

    setError('')
    setSubmitting(true)
    try {
      if (!navigator.onLine) {
        writePendingWeighings([...readPendingWeighings(), payload])
        addRow({
          id: crypto.randomUUID(),
          ...payload,
        })
        setOpen(false)
        setForm({ ...emptyForm, fecha_pesaje: todayIso() })
        setToast({
          message: 'Guardado local. Se sincronizará al volver online.',
          tone: 'warn',
        })
        return
      }

      const saved = await saveWeighing(payload, user?.id)
      addRow(saved)
      setOpen(false)
      setForm({ ...emptyForm, fecha_pesaje: todayIso() })
      setToast({ message: 'Pesaje guardado en la finca.', tone: 'ok' })
    } catch (cause) {
      setError(weighingErrorMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 pt-10 text-sm text-stone-500">Cargando…</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
            CONTROL DE PESO
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            Pesajes
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {activeFarm
              ? `${filtered.length} registros en ${activeFarm.nombre}`
              : 'Selecciona una finca desde Inicio para ver los pesajes.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('')
            setOpen(true)
          }}
          disabled={!activeFarm}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="size-4" />
          Agregar
        </button>
      </header>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-stone-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${fieldClass} pl-10`}
          placeholder="Buscar por DIIO o identificador"
        />
      </div>

      {filtered.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
          <Scale className="mx-auto size-10 text-stone-300" />
          <p className="mt-3 font-serif text-xl font-semibold text-stone-800">
            Sin pesajes para mostrar
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Usa Agregar o el pesaje rápido de Inicio para registrar el primero.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-stone-900">
                  {item.bovine ? bovineLabel(item.bovine) : 'Bovino'}
                </p>
                <p className="mt-1 text-xs text-stone-500">{item.fecha_pesaje}</p>
              </div>
              <p className="font-serif text-2xl font-semibold text-stone-900">
                {item.peso_kg.toFixed(1)}
                <span className="ml-1 text-sm font-sans font-medium text-stone-400">
                  kg
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Agregar pesaje"
        description={
          activeFarm
            ? `Se guardará en ${activeFarm.nombre}.`
            : 'Selecciona una finca activa para guardar.'
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field id="pesaje-bovino" label="Bovino">
            <select
              id="pesaje-bovino"
              required
              value={form.bovino_id}
              onChange={(event) => update('bovino_id', event.target.value)}
              className={fieldClass}
            >
              <option value="">Selecciona un bovino</option>
              {bovines
                .filter((item) => item.estado === 'ACTIVO')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {bovineLabel(item)}
                  </option>
                ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pesaje-peso" label="Peso (kg)">
              <input
                id="pesaje-peso"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                required
                value={form.peso_kg}
                onChange={(event) => update('peso_kg', event.target.value)}
                className={`${fieldClass} font-serif text-2xl font-semibold`}
                placeholder="0.0"
              />
            </Field>
            <Field id="pesaje-fecha" label="Fecha">
              <input
                id="pesaje-fecha"
                type="date"
                required
                value={form.fecha_pesaje}
                onChange={(event) => update('fecha_pesaje', event.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
          <Field id="pesaje-obs" label="Observaciones (opcional)">
            <textarea
              id="pesaje-obs"
              rows={3}
              maxLength={200}
              value={form.observaciones}
              onChange={(event) => update('observaciones', event.target.value)}
              className={`${fieldClass} resize-none`}
              placeholder="Condición corporal, lote, etc."
            />
          </Field>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || !activeFarm}
            className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Guardando…' : 'Guardar pesaje'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
