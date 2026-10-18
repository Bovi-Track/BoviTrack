import { projectOperation } from './project.ts'
import type { CachedData, OfflineOperation } from './types.ts'

let connection: Promise<IDBDatabase> | undefined

// Abre los dos almacenes locales: respuestas autorizadas y operaciones pendientes.
function openDatabase() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('bovitrack-offline', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      const cache = db.createObjectStore('cache', { keyPath: ['user_id', 'key'] })
      cache.createIndex('user', 'user_id')
      const queue = db.createObjectStore('queue', { keyPath: 'sequence', autoIncrement: true })
      queue.createIndex('user', 'userId')
      queue.createIndex('id', 'id', { unique: true })
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); connection = undefined }
      resolve(db)
    }
    request.onerror = () => { connection = undefined; reject(request.error) }
    request.onblocked = () => reject(new Error('Cierra las otras pestañas para actualizar los datos offline.'))
  })
  return connection
}

// Convierte una petición de IndexedDB en una promesa conservando su error.
function value<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Espera el commit de la transacción antes de confirmar una captura.
function completed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('No se pudieron guardar los datos en el dispositivo.'))
  })
}

// Consulta una respuesta local exclusivamente para su usuario propietario.
export async function readCache<T>(userId: string, key: string): Promise<T | undefined> {
  const db = await openDatabase()
  const entry = await value(db.transaction('cache').objectStore('cache').get([userId, key])) as CachedData | undefined
  return entry?.value as T | undefined
}

// Conserva una respuesta online para poder consultarla posteriormente sin conexión.
export async function writeCache(userId: string, key: string, farmId: string | null, data: unknown) {
  const db = await openDatabase()
  const tx = db.transaction('cache', 'readwrite')
  const done = completed(tx)
  tx.objectStore('cache').put({ user_id: userId, key, farm_id: farmId, value: data } satisfies CachedData)
  await done
}

// RF-TR-01: persiste la captura y conserva el orden de inserción entre pestañas.
export async function enqueue(op: OfflineOperation) {
  const db = await openDatabase()
  const tx = db.transaction('queue', 'readwrite')
  const done = completed(tx)
  tx.objectStore('queue').add(op)
  await done
}

// Lee únicamente los pendientes y rechazos del usuario autenticado.
export async function operations(userId: string): Promise<OfflineOperation[]> {
  const db = await openDatabase()
  return value(db.transaction('queue').objectStore('queue').index('user').getAll(userId))
}

// Actualiza o descarta una operación después de comprobar su propietario.
export async function changeOperation(userId: string, id: string, error: string | null, discard = false) {
  const db = await openDatabase()
  const tx = db.transaction('queue', 'readwrite')
  const done = completed(tx)
  const queue = tx.objectStore('queue')
  const request = queue.index('id').get(id)
  request.onsuccess = () => {
    const op = request.result as OfflineOperation | undefined
    if (op?.userId !== userId) return
    if (discard) queue.delete(op.sequence!)
    else queue.put({ ...op, state: error ? 'rejected' : 'pending', error })
  }
  await done
}

// RF-TR-02: aplica la confirmación a la caché y retira la captura en un mismo commit.
export async function acknowledge(op: OfflineOperation, result: unknown) {
  const db = await openDatabase()
  const tx = db.transaction(['cache', 'queue'], 'readwrite')
  const done = completed(tx)
  const queue = tx.objectStore('queue')
  const request = queue.index('id').get(op.id)
  request.onsuccess = () => {
    const current = request.result as OfflineOperation | undefined
    if (current?.userId !== op.userId) return
    const cache = tx.objectStore('cache')
    const entries = cache.index('user').openCursor(op.userId)
    entries.onsuccess = () => {
      const cursor = entries.result
      if (!cursor) return
      const entry = cursor.value as CachedData
      cursor.update({ ...entry, value: projectOperation(entry, op, result) })
      cursor.continue()
    }
    queue.delete(current.sequence!)
  }
  await done
}

// Limpia los datos del usuario al cerrar completamente su sesión.
export async function clearOfflineUser(userId: string) {
  const db = await openDatabase()
  const tx = db.transaction(['cache', 'queue'], 'readwrite')
  const done = completed(tx)
  for (const name of ['cache', 'queue']) {
    const request = tx.objectStore(name).index('user').openCursor(userId)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) { cursor.delete(); cursor.continue() }
    }
  }
  await done
}
