import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthContextValue = {
  user: User | null
  loading: boolean
  passwordRecovery: boolean
  accessError?: string | null
  clearPasswordRecovery: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Obtiene la sesión compartida y exige que exista un AuthProvider.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
