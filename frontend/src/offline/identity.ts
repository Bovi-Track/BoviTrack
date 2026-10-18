import type { User } from '@supabase/supabase-js'

const KEY = 'bovitrack-offline-user'

// Recupera la última identidad autenticada para abrir datos locales sin consultar la red.
export function readOfflineIdentity(): User | null {
  try {
    const storage = localStorage.getItem('bovitrack-remember') === '1' ? localStorage : sessionStorage
    const raw = storage.getItem(KEY)
    return raw ? JSON.parse(raw) as User : null
  } catch { return null }
}

// Conserva solo la identidad; los permisos se vuelven a verificar al sincronizar.
export function saveOfflineIdentity(user: User | null) {
  const persistent = localStorage.getItem('bovitrack-remember') === '1'
  const storage = persistent ? localStorage : sessionStorage
  const other = persistent ? sessionStorage : localStorage
  other.removeItem(KEY)
  if (user) storage.setItem(KEY, JSON.stringify(user))
  else storage.removeItem(KEY)
}
