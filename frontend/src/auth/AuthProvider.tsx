import { AuthContext } from './useAuth.ts'
import { getPendingInvite } from '../lib/pending-invite.ts'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import { isConnectionError, isOnline, setOfflineUser, startOfflineSync } from '../offline/runtime.ts'
import { readOfflineIdentity, saveOfflineIdentity } from '../offline/identity.ts'
import { INACTIVE_ACCOUNT, verifyActiveAccount } from './access.ts'

// RF-UC14-01/03 y RF-UC14-02: publica solo cuentas verificadas y conserva la recuperación.
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let active = true
    let revision = 0
    let authEventReceived = false
    let candidate: User | null = null
    let publishedId: string | null = null
    let checking = false
    const scheduled = new Set<number>()

    // Publica la identidad antes de que las pantallas consulten sus datos locales.
    function applyUser(next: User | null) {
      if (!active) return
      publishedId = next?.id ?? null
      setOfflineUser(next?.id ?? null)
      setUser(next)
      setLoading(false)
    }

    // Retira el acceso y el token sin borrar la cola ni los datos de su propietario.
    function requireLogin(message = 'Tu sesión ya no es válida. Inicia sesión para continuar.') {
      revision++
      candidate = null
      saveOfflineIdentity(null)
      setAccessError(message)
      applyUser(null)
      void supabase.auth.signOut({ scope: 'local' })
    }

    // Verifica en línea; sin red solo recupera una identidad previamente autorizada.
    async function validate(next: User | null, ticket: number) {
      if (!active || ticket !== revision) return
      if (!next) { applyUser(null); return }
      if (!isOnline()) {
        const cached = readOfflineIdentity()
        applyUser(cached?.id === next.id ? cached : null)
        return
      }
      try {
        const allowed = await verifyActiveAccount()
        if (!active || ticket !== revision) return
        if (!allowed) { requireLogin(INACTIVE_ACCOUNT); return }
        saveOfflineIdentity(next)
        setAccessError(null)
        applyUser(next)
        window.dispatchEvent(new Event('bovitrack:access'))
      } catch (cause) {
        if (!active || ticket !== revision) return
        const cached = readOfflineIdentity()
        if (isConnectionError(cause) && cached?.id === next.id) applyUser(cached)
        else requireLogin('No se pudo verificar el acceso. Inicia sesión con conexión para continuar.')
      }
    }

    const stopSync = startOfflineSync()
    const reauth = () => requireLogin()
    window.addEventListener('bovitrack:reauth', reauth)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authEventReceived = true
      const ticket = ++revision
      candidate = event === 'SIGNED_OUT' ? null : session?.user ?? (!isOnline() ? readOfflineIdentity() : null)
      if (event === 'SIGNED_OUT') {
        saveOfflineIdentity(null)
        setPasswordRecovery(false)
        applyUser(null)
        return
      }
      const next = candidate
      if (publishedId && next?.id !== publishedId) {
        publishedId = null
        setOfflineUser(null)
        setUser(null)
        setLoading(true)
      }
      // Las consultas del SDK se ejecutan fuera de su callback de autenticación.
      const timer = window.setTimeout(() => {
        scheduled.delete(timer)
        void validate(next, ticket)
      }, 0)
      scheduled.add(timer)
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        navigate('/restablecer-contrasena', { replace: true })
      }
      if (event === 'SIGNED_IN') {
        const invite = getPendingInvite()
        if (invite && window.location.pathname !== '/unirse') {
          navigate(`/unirse?token=${encodeURIComponent(invite)}`, { replace: true })
        }
      }
    })

    if (!isOnline()) {
      candidate = readOfflineIdentity()
      applyUser(candidate)
    } else {
      void supabase.auth.getUser().then(({ data, error }) => {
        if (!active || authEventReceived) return
        candidate = error && isConnectionError(error) ? readOfflineIdentity() : data.user
        return validate(candidate, ++revision)
      }).catch((cause: unknown) => {
        if (!active || authEventReceived) return
        candidate = isConnectionError(cause) ? readOfflineIdentity() : null
        applyUser(candidate)
      })
    }

    // Revalida cuentas desactivadas durante la sesión y refresca sus roles por finca.
    const recheck = () => {
      if (!candidate || !isOnline() || checking) return
      checking = true
      void validate(candidate, ++revision).finally(() => { checking = false })
    }
    window.addEventListener('online', recheck)
    window.addEventListener('focus', recheck)
    const timer = window.setInterval(recheck, 30000)
    return () => {
      active = false
      revision++
      subscription.unsubscribe()
      stopSync()
      scheduled.forEach(window.clearTimeout)
      window.clearInterval(timer)
      window.removeEventListener('online', recheck)
      window.removeEventListener('focus', recheck)
      window.removeEventListener('bovitrack:reauth', reauth)
    }
  }, [navigate])

  const value = useMemo(() => ({
    user, loading, passwordRecovery, accessError,
    clearPasswordRecovery: () => setPasswordRecovery(false),
  }), [user, loading, passwordRecovery, accessError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
