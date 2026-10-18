import { supabase } from '../lib/supabase.ts'
import { projectOperation } from './project.ts'
import { acknowledge, changeOperation, enqueue, operations, readCache, writeCache } from './store.ts'
import type { CachedData, CaptureResult, OperationKind } from './types.ts'

let userId: string | null = null
let syncing: Promise<void> | null = null
const localLocks = new Map<string, Promise<unknown>>()

// Vincula la capa local al usuario de AuthProvider sin compartir datos entre cuentas.
export function setOfflineUser(id: string | null) {
  if (userId === id) return
  userId = id
  notifyOffline()
  if (id) queueMicrotask(() => { void syncPending().catch(notifyOffline) })
}

// Obtiene el propietario de las lecturas y capturas de esta sesión.
export function offlineUser() {
  if (!userId) throw new Error('Inicia sesión para acceder a los datos del dispositivo.')
  return userId
}

// Detecta conexión del navegador; la confirmación real depende de la respuesta del servidor.
export function isOnline() { return typeof navigator === 'undefined' || navigator.onLine !== false }

// Exige conexión para las funciones administrativas y los reportes.
export function requireConnection() {
  if (!isOnline()) throw new Error('Esta operación requiere conexión a internet.')
}

// Distingue fallos de transporte de rechazos de permisos o reglas de negocio.
export function isConnectionError(cause: unknown) {
  const error = cause as { code?: string; message?: string; name?: string; cause?: unknown }
  if (error?.cause) return isConnectionError(error.cause)
  return error?.name === 'AbortError' || error?.name === 'TimeoutError' ||
    (!error?.code && /fetch|network|load failed|offline|connection|conexi[oó]n|timeout|timed out|aborted/i.test(error?.message ?? ''))
}

// Serializa consultas y sincronización entre pestañas cuando Web Locks está disponible.
export async function withOfflineLock<T>(id: string, action: () => Promise<T>, scope = 'data'): Promise<T> {
  const key = `bovitrack-${scope}:${id}`
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(key, action)
  }
  const next = (localLocks.get(key) ?? Promise.resolve()).then(action, action)
  localLocks.set(key, next.catch(() => undefined))
  return next
}

// Avisa a la interfaz y a las demás pestañas que cambió la cola local.
export function notifyOffline() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('bovitrack:offline'))
}

// RF-TR-01: consulta online y conserva una copia; sin red utiliza solo datos del mismo usuario.
export async function cachedRead<T>(key: string, farmId: string | null, fetcher: () => Promise<T>): Promise<T> {
  if (typeof indexedDB === 'undefined') return fetcher()
  const owner = offlineUser()
  return withOfflineLock(owner, async () => {
    if (userId !== owner) throw new Error('La sesión cambió; vuelve a abrir la pantalla.')
    const pending = (await operations(owner)).filter((op) => op.farmId === farmId)
    let data: T | undefined
    // No mezcla saldos nuevos con capturas cuyo commit remoto aún no se pudo confirmar.
    if (isOnline() && pending.length === 0) {
      try {
        data = await fetcher()
        if (userId !== owner) throw new Error('La sesión cambió; vuelve a abrir la pantalla.')
        await writeCache(owner, key, farmId, data)
      } catch (cause) {
        if (!isConnectionError(cause)) throw cause
      }
    }
    data ??= await readCache<T>(owner, key)
    if (data === undefined) throw new Error('Estos datos todavía no están disponibles offline. Ábrelos con conexión primero.')
    const entry: CachedData = { user_id: owner, farm_id: farmId, key, value: data }
    for (const op of await operations(owner)) {
      if (op.state === 'pending') entry.value = projectOperation(entry, op, op.optimistic)
    }
    if (userId !== owner) throw new Error('La sesión cambió; vuelve a abrir la pantalla.')
    return entry.value as T
  })
}

// RF-TR-01: persiste una de las cuatro capturas antes de confirmar su guardado local.
export async function capture<T>(farmId: string, kind: OperationKind,
  payload: Record<string, unknown>, optimistic: (id: string) => T): Promise<CaptureResult<T>> {
  const owner = offlineUser()
  return withOfflineLock(owner, async () => {
    const access = await readCache<{ farm: { id: string; activo: boolean }; role: string }[]>(owner, 'farms')
    const farm = access?.find((entry) => entry.farm.id === farmId)
    if (!farm?.farm.activo || !['admin', 'campo'].includes(farm.role)) {
      throw new Error('No tienes una finca activa autorizada para esta captura.')
    }
    const id = crypto.randomUUID()
    const data = optimistic(id)
    if (userId !== owner) throw new Error('La sesión cambió; vuelve a abrir la pantalla.')
    await enqueue({ id, userId: owner, farmId, kind, payload, optimistic: data,
      state: 'pending', error: null, createdAt: new Date().toISOString() })
    notifyOffline()
    void syncPending().catch(notifyOffline)
    if (userId !== owner) throw new Error('La captura quedó guardada para el usuario anterior. Vuelve a abrir la pantalla.')
    return { data, pending: true, operationId: id }
  }, 'capture')
}

// RF-TR-02: envía en orden, conserva fallos de red y separa rechazos sin perder capturas.
export async function syncPending() {
  if (syncing) return syncing
  if (!userId || !isOnline()) return
  const owner = userId
  syncing = withOfflineLock(owner, async () => {
    if (!isOnline() || userId !== owner) return
    const { data: auth, error: authError } = await supabase.auth.getSession()
    if (authError || auth.session?.user.id !== owner) {
      if (userId === owner && !isConnectionError(authError)) window.dispatchEvent(new Event('bovitrack:reauth'))
      return
    }
    for (const op of await operations(owner)) {
      if (userId !== owner || !isOnline()) break
      // Un rechazo bloquea la cola para conservar el orden hasta que se revise.
      if (op.state === 'rejected') break
      const { data, error } = await supabase.rpc('procesar_operacion_offline', {
        p_operacion_id: op.id, p_finca_id: op.farmId, p_tipo: op.kind, p_datos: op.payload,
      }).setHeader('Authorization', `Bearer ${auth.session.access_token}`)
        .abortSignal(AbortSignal.timeout(15000))
      if (error) {
        if (isConnectionError(error)) break
        if (error.code === 'PGRST301' || error.code === 'PGRST303') {
          window.dispatchEvent(new Event('bovitrack:reauth'))
          break
        }
        if (error.code === '42501' && error.message.includes('CUENTA_INACTIVA')) {
          window.dispatchEvent(new Event('bovitrack:reauth'))
          break
        }
        const message = error.code === 'PGRST202'
          ? 'Falta aplicar el SQL de sincronización offline en Supabase.' : error.message
        await changeOperation(owner, op.id, message)
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('bovitrack:synced'))
        break
      }
      await acknowledge(op, data)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('bovitrack:synced'))
    }
  }).finally(() => { syncing = null; notifyOffline() })
  notifyOffline()
  return syncing
}

// RF-TR-02: activa los reintentos desde cualquier pantalla mientras la aplicación está abierta.
export function startOfflineSync() {
  // Los reintentos reutilizan el identificador persistido incluso después de una respuesta perdida.
  const sync = () => { void syncPending().catch(notifyOffline) }
  window.addEventListener('online', sync)
  window.addEventListener('focus', sync)
  const timer = window.setInterval(sync, 30000)
  sync()
  return () => {
    window.removeEventListener('online', sync)
    window.removeEventListener('focus', sync)
    window.clearInterval(timer)
  }
}

// Reintenta o descarta únicamente una captura elegida por su propietario.
export async function reviewOperation(id: string, discard = false) {
  const owner = offlineUser()
  await withOfflineLock(owner, () => changeOperation(owner, id, null, discard))
  window.dispatchEvent(new Event('bovitrack:synced'))
  notifyOffline()
  void syncPending().catch(notifyOffline)
}
