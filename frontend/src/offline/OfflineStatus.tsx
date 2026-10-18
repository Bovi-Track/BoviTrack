import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { useFarm } from '../context/useFarm.ts'
import { loadBovines } from '../lib/bovines.ts'
import { loadInventory } from '../lib/inventory.ts'
import { loadSanitaryRecords, loadTreatments } from '../lib/sanitary.ts'
import { loadTasks } from '../lib/tasks.ts'
import { loadWeighings, readPendingWeighings } from '../lib/weighings.ts'
import { isOnline, reviewOperation, syncPending } from './runtime.ts'
import { operations, readCache, writeCache } from './store.ts'
import type { OfflineOperation } from './types.ts'

const names = { weighing: 'Pesaje', sanitary: 'Sanidad', inventory: 'Inventario', task: 'Tarea' }

// RF-TR-01 y RF-TR-02: prepara datos operativos y muestra pendientes y rechazos en todas las pantallas.
export function OfflineStatus() {
  const { user } = useAuth()
  const { activeFarm, farms } = useFarm()
  const [queue, setQueue] = useState<OfflineOperation[]>([])
  const [online, setOnline] = useState(isOnline)
  const [message, setMessage] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const legacy = readPendingWeighings().length

  useEffect(() => {
    if (!user) return
    let active = true
    // Actualiza el contador desde IndexedDB; incluye cambios realizados en otras pestañas.
    const update = () => {
      setOnline(isOnline())
      void operations(user.id).then((rows) => { if (active) setQueue(rows) })
        .catch(() => { if (active) setMessage('No se pudo abrir el almacenamiento offline.') })
    }
    update()
    window.addEventListener('bovitrack:offline', update)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const timer = window.setInterval(update, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('bovitrack:offline', update)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [user])

  useEffect(() => {
    if (!user || !activeFarm) return
    let active = true
    const owner = user.id
    const farm = activeFarm.id
    // Descarga solo los datos de la finca seleccionada necesarios para las cuatro capturas.
    async function prepare() {
      setPreparing(true)
      setReady(false)
      try {
        if (!isOnline()) {
          const cached = await readCache(owner, `ready:${farm}`)
          if (active) setReady(Boolean(cached))
          return
        }
        const bovines = await loadBovines(farm)
        const ids = bovines.map((item) => item.id)
        await Promise.all([loadWeighings(ids, farm), loadTreatments(ids, farm),
          loadSanitaryRecords(farm), loadTasks(farm), loadInventory(farm)])
        await writeCache(owner, `ready:${farm}`, farm, new Date().toISOString())
        if (active) { setReady(true); setMessage('') }
      } catch (cause) {
        if (active) setMessage(cause instanceof Error ? cause.message : 'No se pudieron preparar los datos offline.')
      } finally {
        if (active) setPreparing(false)
      }
    }
    void prepare()
    return () => { active = false }
  }, [user, activeFarm, online, attempt])

  // Reintenta la preparación y sincronización sin borrar los errores ni las capturas.
  async function retry() {
    setAttempt((current) => current + 1)
    try { await syncPending() }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo sincronizar.') }
  }

  return <aside aria-label="Estado de sincronización" className="border-b border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">
    <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1">
      <span>{online ? 'Con conexión' : 'Sin conexión'} · {queue.length ? `${queue.length} captura(s) sin confirmar` : 'Sin capturas pendientes'}</span>
      <span className="text-xs">{preparing ? 'Preparando datos offline…' : ready ? 'Datos de esta finca disponibles offline' : 'Abre esta finca con conexión para preparar sus datos'}</span>
      <button type="button" disabled={!online} onClick={() => void retry()} className="min-h-10 underline disabled:opacity-50">Sincronizar</button>
      {message ? <p role="alert" className="w-full text-red-700">{message}</p> : null}
      {legacy ? <p role="alert" className="w-full text-amber-800">Hay {legacy} pesaje(s) en la cola antigua sin propietario identificado. Se conservan para revisión y no se enviarán automáticamente.</p> : null}
      {queue.length ? <details className="w-full"><summary className="cursor-pointer py-2">Revisar capturas</summary>
        <ul className="space-y-2">{queue.map((op) => <li key={op.id} className="rounded-lg border border-stone-200 p-2">
          <p>{names[op.kind]} · {farms.find((farm) => farm.id === op.farmId)?.nombre ?? 'Finca anterior'} · {new Date(op.createdAt).toLocaleString('es-CR')} · {op.state === 'rejected' ? 'Requiere revisión' : 'Pendiente'}</p>
          <p className="text-xs">{String(op.payload.producto ?? op.payload.tipo ?? op.payload.estado ?? 'Pesaje')} · {String(op.payload.peso_kg ?? op.payload.cantidad ?? op.payload.dosis ?? '')} · {String(op.payload.fecha ?? op.payload.fecha_pesaje ?? '')}</p>
          {op.error ? <p role="alert" className="text-red-700">{op.error}</p> : null}
          {op.state === 'rejected' ? <div className="flex gap-4">
            <button type="button" onClick={() => void reviewOperation(op.id)} className="min-h-10 underline">Reintentar captura</button>
            <button type="button" onClick={() => void reviewOperation(op.id, true)} className="min-h-10 text-red-700 underline">Descartar captura rechazada</button>
          </div> : null}
        </li>)}</ul>
      </details> : null}
    </div>
  </aside>
}
