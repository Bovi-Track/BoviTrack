import { AuthContext } from './useAuth.ts'
import { getPendingInvite } from '../lib/pending-invite.ts'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import { isConnectionError, isOnline, setOfflineUser, startOfflineSync } from '../offline/runtime.ts'
import { readOfflineIdentity, saveOfflineIdentity } from '../offline/identity.ts'

// RF-UC14-01 y RF-UC14-02: mantiene una sola sesión observable y su estado de recuperación.
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let active = true

    // Publica la identidad antes de que las pantallas consulten sus datos locales.
    function applyUser(next: User | null) {
      if (!active) return
      setOfflineUser(next?.id ?? null)
      setUser(next)
      setLoading(false)
    }

    if (!isOnline()) applyUser(readOfflineIdentity())
    else void supabase.auth.getUser().then(({ data, error }) => {
      const next = error && isConnectionError(error) ? readOfflineIdentity() : data.user
      if (!error) saveOfflineIdentity(next)
      applyUser(next)
    }).catch(() => applyUser(readOfflineIdentity()))

    const stopSync = startOfflineSync()
    // Conserva la cola del propietario y solicita autenticación si Supabase rechaza su sesión.
    const requireLogin = () => {
      saveOfflineIdentity(null)
      applyUser(null)
      // Invalida la sesión del SDK sin borrar los datos ni la cola del propietario.
      void supabase.auth.signOut({ scope: 'local' })
    }
    window.addEventListener('bovitrack:reauth', requireLogin)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ?? (!isOnline() ? readOfflineIdentity() : null)
      if (session?.user) saveOfflineIdentity(session.user)
      applyUser(next)

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
        if (isOnline()) saveOfflineIdentity(null)
        setPasswordRecovery(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
      stopSync()
      window.removeEventListener('bovitrack:reauth', requireLogin)
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
