import { closeOfflineDatabase } from '../offline/store.ts'

export async function wipeOfflineDatabase() {
  await closeOfflineDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('bovitrack-offline')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}
