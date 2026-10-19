import { useEffect, useState } from 'react'
import { Activity, ArrowRightLeft, ClipboardList, Scale, ShoppingCart, Syringe } from 'lucide-react'
import { loadBovineTraceability } from '../../lib/bovine-traceability.ts'
import { bovineErrorMessage } from '../../lib/bovines.ts'
import { formatDayLong } from '../../lib/dates.ts'
import type { BovineTraceEvent, BovineTraceEventKind } from '../../types/bovine-traceability.ts'

const eventStyle: Record<BovineTraceEventKind, { label: string; className: string; icon: typeof Activity }> = {
  COMPRA: { label: 'Compra', className: 'bg-sky-100 text-sky-800', icon: ShoppingCart },
  MOVIMIENTO: { label: 'Movimiento', className: 'bg-amber-100 text-amber-800', icon: ArrowRightLeft },
  PESAJE: { label: 'Pesaje', className: 'bg-indigo-100 text-indigo-800', icon: Scale },
  SANIDAD: { label: 'Sanidad', className: 'bg-emerald-100 text-emerald-800', icon: Syringe },
  VENTA: { label: 'Venta', className: 'bg-violet-100 text-violet-800', icon: ClipboardList },
  BAJA: { label: 'Baja', className: 'bg-rose-100 text-rose-800', icon: Activity },
}

// RF-UC02-01: presenta en una sola secuencia compra, movimientos, pesajes, sanidad, venta y baja.
export function BovineTraceability({ bovineId, refreshKey = 0 }: { bovineId: string; refreshKey?: number }) {
  const [events, setEvents] = useState<BovineTraceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await loadBovineTraceability(bovineId)
        if (active) setEvents(result)
      } catch (reason) {
        if (active) {
          setEvents([])
          setError(bovineErrorMessage(reason))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [bovineId, refreshKey, revision])

  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-stone-900">Trazabilidad completa</h2>
          <p className="mt-1 text-sm text-stone-500">Eventos ordenados por fecha, del más antiguo al más reciente.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}
          className="min-h-11 text-sm font-medium text-bovi disabled:opacity-50">
          Actualizar
        </button>
      </div>
      {loading ? <p className="text-sm text-stone-500">Cargando trazabilidad…</p> : error ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : events.length ? (
        <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-stone-200">
          {events.map((event) => <TraceEvent key={`${event.tipo_evento}:${event.evento_id}`} event={event} />)}
        </ol>
      ) : <p className="text-sm text-stone-500">Todavía no hay eventos registrados para este toro.</p>}
    </section>
  )
}

function TraceEvent({ event }: { event: BovineTraceEvent }) {
  const style = eventStyle[event.tipo_evento]
  const Icon = style.icon
  return (
    <li className="relative flex gap-3">
      <span className={`z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${style.className}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-semibold text-stone-900">{event.titulo}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.className}`}>{style.label}</span>
          <time className="text-xs text-stone-500">{formatDayLong(event.fecha_evento)}</time>
        </div>
        {event.detalle ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-700">{event.detalle}</p> : null}
        <p className="mt-1 text-xs text-stone-500">Registrado por {event.responsable}</p>
      </div>
    </li>
  )
}
