import { useState, type FormEvent } from 'react'
import { Field, Modal, fieldClass } from '../dashboard/Modal.tsx'
import { useFarm } from '../../context/useFarm.ts'
import { registerBovineMovement } from '../../lib/bovine-movements.ts'
import { bovineErrorMessage } from '../../lib/bovines.ts'
import { todayIso } from '../../lib/dates.ts'
import type { Bovine } from '../../types/dashboard.ts'
import type { BovineMovementInput, BovineMovementKind, BovineMovementResult } from '../../types/bovine-movements.ts'
import { BovineMovementHistory } from './BovineMovementHistory.tsx'

const titles: Record<BovineMovementKind, string> = {
  RETIRO: 'Retirar toro', ASIGNACION: 'Asignar toro', TRASLADO: 'Trasladar toro',
}
const descriptions: Record<BovineMovementKind, string> = {
  RETIRO: 'Quedará inactivo y conservará su última finca e historial. Podrás asignarlo nuevamente.',
  ASIGNACION: 'Volverá a estar activo en la finca seleccionada. Se conserva su historial y su fecha de ingreso original.',
  TRASLADO: 'Saldrá del hato de esta finca y quedará activo en el destino, conservando su historial y su fecha de ingreso original.',
}

// RF-UC03-02: movimientos online del toro; los destinos requieren administración en ambas fincas.
export function BovineMovementSection({ bovine, onRegistered }: {
  bovine: Bovine
  onRegistered: (result: BovineMovementResult) => void
}) {
  const { activeFarm, farms, rolesByFarm, role } = useFarm()
  const [draft, setDraft] = useState<BovineMovementInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  if (!activeFarm || bovine.finca_id !== activeFarm.id) return null
  const destinations = farms.filter((farm) => farm.activo && rolesByFarm[farm.id] === 'admin' &&
    (draft?.kind !== 'TRASLADO' || farm.id !== activeFarm.id))
  const canManage = role === 'admin' && activeFarm.activo

  function open(kind: BovineMovementKind) {
    setError('')
    setMessage('')
    setDraft({ bovineId: bovine.id, originId: bovine.finca_id, kind, destinationId: kind === 'ASIGNACION' ? bovine.finca_id : null,
      date: todayIso(), notes: '', operationId: crypto.randomUUID() })
  }

  // Cambiar los datos crea otra solicitud; un reintento sin cambios conserva su identificador.
  function change(patch: Partial<BovineMovementInput>) {
    setDraft((current) => current ? { ...current, ...patch, operationId: crypto.randomUUID() } : null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft || busy || !canManage) return
    setBusy(true)
    setError('')
    try {
      const result = await registerBovineMovement(draft)
      setDraft(null)
      setRevision((value) => value + 1)
      setMessage(draft.kind === 'RETIRO' ? 'Retiro registrado. El toro quedó inactivo.' :
        draft.kind === 'ASIGNACION' ? 'Asignación registrada. El toro quedó activo.' : 'Traslado registrado. El toro está en la finca de destino.')
      onRegistered(result)
    } catch (reason) { setError(bovineErrorMessage(reason)) }
    finally { setBusy(false) }
  }

  return (
    <>
      {canManage && ['ACTIVO', 'INACTIVO'].includes(bovine.estado) ? (
        <section className="mt-5 space-y-3 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Movimientos del toro</h2>
          <div className="flex flex-wrap gap-3">
            {bovine.estado === 'ACTIVO' ? <>
              <button type="button" onClick={() => open('TRASLADO')} className="min-h-11 rounded-xl bg-bovi px-4 text-sm font-medium text-white">Trasladar</button>
              <button type="button" onClick={() => open('RETIRO')} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-700">Retirar</button>
            </> : <button type="button" onClick={() => open('ASIGNACION')} className="min-h-11 rounded-xl bg-bovi px-4 text-sm font-medium text-white">Asignar nuevamente</button>}
          </div>
          {message ? <p role="status" className="text-sm text-bovi">{message}</p> : null}
        </section>
      ) : null}
      <BovineMovementHistory key={`${bovine.id}:${revision}`} farmId={activeFarm.id} bovineId={bovine.id} />
      <Modal open={Boolean(draft)} onClose={() => { if (!busy) setDraft(null) }} title={draft ? titles[draft.kind] : ''}
        description={draft ? descriptions[draft.kind] : ''}>
        {draft ? <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-stone-700">{draft.kind === 'ASIGNACION' ? 'Última finca' : 'Finca de origen'}: {activeFarm.nombre}</p>
          {draft.kind !== 'RETIRO' ? (
            <Field id="movimiento-destino" label="Finca de destino">
              <select id="movimiento-destino" required value={draft.destinationId ?? ''}
                onChange={(event) => change({ destinationId: event.target.value || null })} className={fieldClass}>
                <option value="">Selecciona una finca</option>
                {destinations.map((farm) => <option key={farm.id} value={farm.id}>{farm.nombre}</option>)}
              </select>
              {!destinations.length ? <p className="text-sm text-stone-600">Necesitas otra finca activa donde seas administrador para trasladar.</p> : null}
            </Field>
          ) : null}
          <Field id="movimiento-fecha" label="Fecha del movimiento">
            <input id="movimiento-fecha" type="date" required min={bovine.fecha_ingreso} max={todayIso()} value={draft.date}
              onChange={(event) => change({ date: event.target.value })} className={fieldClass} />
          </Field>
          <Field id="movimiento-notas" label="Observaciones (opcional)">
            <textarea id="movimiento-notas" maxLength={2000} value={draft.notes}
              onChange={(event) => change({ notes: event.target.value })} className={fieldClass} />
          </Field>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <button disabled={busy || (draft.kind !== 'RETIRO' && !draft.destinationId)}
            className="min-h-12 w-full rounded-xl bg-bovi px-4 font-medium text-white disabled:opacity-50">
            {busy ? 'Guardando…' : draft.kind === 'RETIRO' ? 'Confirmar retiro' : draft.kind === 'ASIGNACION' ? 'Confirmar asignación' : 'Confirmar traslado'}
          </button>
        </form> : null}
      </Modal>
    </>
  )
}
