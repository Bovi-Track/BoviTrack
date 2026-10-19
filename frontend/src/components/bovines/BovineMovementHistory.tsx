import { useEffect, useState } from 'react'
import { bovineMovementLabels, loadBovineMovements } from '../../lib/bovine-movements.ts'
import { bovineErrorMessage } from '../../lib/bovines.ts'
import { formatDayLong } from '../../lib/dates.ts'
import type { BovineMovement } from '../../types/bovine-movements.ts'

// RF-UC03-02: historial paginado de entradas/salidas de una finca o de un toro autorizado.
export function BovineMovementHistory({ farmId, bovineId = null }: { farmId: string; bovineId?: string | null }) {
  const [rows, setRows] = useState<BovineMovement[]>([])
  const [offset, setOffset] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await loadBovineMovements(farmId, bovineId, offset)
        if (active) { setRows(data.slice(0, 50)); setHasNext(data.length > 50) }
      } catch (reason) {
        if (active) { setRows([]); setError(bovineErrorMessage(reason)) }
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [farmId, bovineId, offset, revision])

  return (
    <section className="mt-5 space-y-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-stone-900">Historial de movimientos</h2>
        <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}
          className="min-h-11 text-sm font-medium text-bovi disabled:opacity-50">Actualizar movimientos</button>
      </div>
      {loading ? <p className="text-sm text-stone-500">Cargando movimientos…</p> : error ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : rows.length ? (
        <ol className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="space-y-1 border-b border-stone-100 pb-4 text-sm text-stone-700 last:border-0 last:pb-0">
              <p className="font-semibold">{bovineMovementLabels[row.tipo]} · {formatDayLong(row.fecha_movimiento)}</p>
              {!bovineId ? <p>{row.nombre ? `${row.nombre} · ` : ''}{row.identificador_interno}</p> : null}
              <p>Origen: {row.finca_origen_nombre ?? 'Sin pertenencia activa'}</p>
              <p>Destino: {row.finca_destino_nombre ?? 'Sin pertenencia activa'}</p>
              {row.responsable ? <p className="text-xs text-stone-500">Registrado por {row.responsable}</p> : null}
              {row.observaciones ? <p className="whitespace-pre-wrap break-words">{row.observaciones}</p> : null}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-stone-500">Sin movimientos registrados.</p>}
      {offset > 0 || hasNext ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button type="button" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 50))}
            className="min-h-11 font-medium text-bovi disabled:opacity-40">Anteriores</button>
          <span>Página {offset / 50 + 1}</span>
          <button type="button" disabled={loading || !hasNext} onClick={() => setOffset((value) => value + 50)}
            className="min-h-11 font-medium text-bovi disabled:opacity-40">Siguientes</button>
        </div>
      ) : null}
    </section>
  )
}
