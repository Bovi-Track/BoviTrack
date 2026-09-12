import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en el entorno.',
  )
}

const REMEMBER_KEY = 'bovitrack-remember'

export function setRememberMe(remember: boolean) {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, '1')
    return
  }
  localStorage.removeItem(REMEMBER_KEY)
}

const authStorage = {
  getItem(key: string) {
    const remember = localStorage.getItem(REMEMBER_KEY) === '1'
    return (remember ? localStorage : sessionStorage).getItem(key)
  },
  setItem(key: string, value: string) {
    const remember = localStorage.getItem(REMEMBER_KEY) === '1'
    const storage = remember ? localStorage : sessionStorage
    const other = remember ? sessionStorage : localStorage
    other.removeItem(key)
    storage.setItem(key, value)
  },
  removeItem(key: string) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
})
