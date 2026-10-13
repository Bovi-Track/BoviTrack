import { AuthContext } from './useAuth.ts'
import { getPendingInvite } from '../lib/pending-invite.ts'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

// RF-UC14-01 y RF-UC14-02: mantiene una sola sesión observable y su estado de recuperación.
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setUser(data.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        if (window.location.pathname !== '/restablecer-contrasena') {
          navigate('/restablecer-contrasena', { replace: true })
        }
      }

      if (event === 'SIGNED_IN') {
        // Si hay un token de invitacion pendiente, redirigir para aceptarlo
        const pendingInvite = getPendingInvite()
        if (pendingInvite && window.location.pathname !== '/unirse') {
          navigate(`/unirse?token=${encodeURIComponent(pendingInvite)}`, { replace: true })
        }
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      loading,
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
    }),
    [user, loading, passwordRecovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
