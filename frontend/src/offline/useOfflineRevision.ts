import { useSyncExternalStore } from 'react'

let revision = 0

// Suscribe las consultas visibles a confirmaciones y revisiones de la cola.
function subscribe(listener: () => void) {
  // Renueva los datos sin desmontar formularios que el usuario tenga abiertos.
  const update = () => { revision++; listener() }
  window.addEventListener('bovitrack:synced', update)
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  return () => {
    window.removeEventListener('bovitrack:synced', update)
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  }
}

// RF-TR-02: permite refrescar listas cuando cambian los datos sincronizados.
export function useOfflineRevision() {
  return useSyncExternalStore(subscribe, () => revision, () => 0)
}
