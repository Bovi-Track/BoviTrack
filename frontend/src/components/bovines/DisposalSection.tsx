import { useEffect, useState, type FormEvent } from 'react'
import { Field, Modal, fieldClass } from '../dashboard/Modal.tsx'
import { bovineErrorMessage } from '../../lib/bovines.ts'
import { formatDayLong, todayIso } from '../../lib/dates.ts'
import {
  completeDisposalLoss, loadDisposalLoss, loadDisposals, registerDisposal,
  type DisposalLoss, type DisposalRecord,
} from '../../lib/disposals.ts'
import type { Bovine } from '../../types/dashboard.ts'

const money = (value: number | null) => value == null ? 'No disponible' :
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(value)

// RF-UC13-01: captura e historial de bajas online; la economía solo se carga para administradores.
export function DisposalSection({ bovine, admin, farmActive, onRegistered }: {
  bovine: Bovine
  admin: boolean
  farmActive: boolean
  onRegistered: () => void
}) {
  const [records, setRecords] = useState<DisposalRecord[]>([])
  const [loss, setLoss] = useState<DisposalLoss | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayIso)
  const [cause, setCause] = useState('')
  const [maintenance, setMaintenance] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const next = await loadDisposals(bovine.id)
        const nextLoss = admin && next[0] ? await loadDisposalLoss(next[0].id) : null
        if (active) { setRecords(next); setLoss(nextLoss); setError('') }
      } catch (reason) {
        if (active) setError(bovineErrorMessage(reason))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [bovine.id, admin, revision])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await registerDisposal(bovine.id, date, cause, admin && maintenance !== '' ? Number(maintenance) : null)
      setOpen(false)
      setMessage('Baja registrada. Se conservan los pesajes y el historial del toro.')
      setRevision((value) => value + 1)
      onRegistered()
    } catch (reason) {
      setError(bovineErrorMessage(reason))
    } finally { setBusy(false) }
  }

  async function complete(event: FormEvent) {
    event.preventDefault()
    if (busy || !records[0] || maintenance === '') return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await completeDisposalLoss(records[0].id, Number(maintenance))
      const next = await loadDisposalLoss(records[0].id)
      setLoss(next)
      setMessage(next.perdida_economica == null
        ? 'Mantenimiento guardado. Faltan datos de compra o flete para calcular la pérdida.'
        : 'Pérdida económica calculada y guardada en el historial.')
    } catch (reason) { setError(bovineErrorMessage(reason)) }
    finally { setBusy(false) }
  }

  const maintenanceField = (required: boolean) => (
    <Field id="baja-mantenimiento" label="Mantenimiento diario por toro (CRC/día)">
      <input id="baja-mantenimiento" type="number" min="0" step="0.01" required={required}
        value={maintenance} onChange={(event) => setMaintenance(event.target.value)} className={fieldClass} />
    </Field>
  )

  return (
    <section className="mt-5 space-y-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-stone-900">Baja e historial</h2>
        {farmActive && bovine.estado === 'ACTIVO' && !records.length ? (
          <button type="button" disabled={loading || busy} onClick={() => { setError(''); setOpen(true) }}
            className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 disabled:opacity-50">
            Registrar baja
          </button>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-stone-500">Cargando bajas…</p> :
        !records.length ? <p className="text-sm text-stone-500">Sin bajas registradas.</p> : null}
      {records.map((record) => (
        <div key={record.id} className="space-y-2 text-sm text-stone-700">
          <p className="font-medium">Baja · {formatDayLong(record.fecha_baja)}</p>
          <p className="whitespace-pre-wrap break-words">{record.causa}</p>
        </div>
      ))}
      {admin && loss ? (
        <div className="space-y-3 border-t border-stone-100 pt-4 text-sm text-stone-700">
          <p className="font-semibold">{loss.perdida_economica == null ? 'Pérdida pendiente de calcular' : `Pérdida económica: ${money(loss.perdida_economica)}`}</p>
          <p>Compra y flete: {money(loss.costo_compra_calculado)}</p>
          <p>Mantenimiento acumulado: {money(loss.mantenimiento_acumulado)}</p>
          {loss.perdida_economica == null && farmActive ? (
            <form onSubmit={complete} className="space-y-3">
              <p>La pérdida suma compra, flete y mantenimiento desde el ingreso hasta la baja. Los costos desconocidos quedan pendientes.</p>
              {maintenanceField(true)}
              <button disabled={busy} className="min-h-11 rounded-xl bg-bovi px-4 font-medium text-white disabled:opacity-50">
                {busy ? 'Guardando…' : 'Calcular pérdida pendiente'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      {error && !open ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-bovi">{message}</p> : null}
      <Modal open={open} onClose={() => { if (!busy) setOpen(false) }} title="Registrar baja"
        description="El toro quedará en estado Baja. Esta operación conserva su historial y no permite reactivarlo ni venderlo.">
        <form onSubmit={submit} className="space-y-4">
          <Field id="baja-fecha" label="Fecha de baja">
            <input id="baja-fecha" type="date" min={bovine.fecha_ingreso} max={todayIso()} required
              value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
          </Field>
          <Field id="baja-causa" label="Causa de baja">
            <textarea id="baja-causa" required maxLength={2000} value={cause}
              onChange={(event) => setCause(event.target.value)} className={fieldClass} />
          </Field>
          {admin ? <>{maintenanceField(false)}<p className="text-sm text-stone-500">
            Opcional. Si faltan mantenimiento o datos de compra y flete, la pérdida quedará pendiente.
          </p></> : null}
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <button disabled={busy || !cause.trim()} className="min-h-12 w-full rounded-xl bg-red-700 px-4 font-medium text-white disabled:opacity-50">
            {busy ? 'Guardando…' : 'Confirmar baja'}
          </button>
        </form>
      </Modal>
    </section>
  )
}
