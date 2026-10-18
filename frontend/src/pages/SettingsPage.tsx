import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { useFarm } from '../context/useFarm.ts'
import { roleLabel } from '../lib/farms.ts'
import { supabase } from '../lib/supabase.ts'
import { useState } from 'react'
import { clearOfflineUser, operations } from '../offline/store.ts'
import { saveOfflineIdentity } from '../offline/identity.ts'
import { setOfflineUser, withOfflineLock } from '../offline/runtime.ts'

// RF-UC14-01: presenta la identidad, rol de finca y acción de cierre de sesión.
export default function SettingsPage() {
  const { user } = useAuth()
  const { activeFarm, role } = useFarm()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const fullName =
    typeof user?.user_metadata.nombre_completo === 'string'
      ? user.user_metadata.nombre_completo
      : user?.email

  // RF-UC14-01 y RF-TR-01: impide perder pendientes y limpia los datos al cerrar sesión.
  async function onLogout() {
    if (!user || closing) return
    setClosing(true)
    setError('')
    try {
      await withOfflineLock(user.id, () => withOfflineLock(user.id, async () => {
        if ((await operations(user.id)).length) throw new Error('Sincroniza o revisa las capturas pendientes antes de cerrar sesión.')
        setOfflineUser(null)
        await clearOfflineUser(user.id)
        saveOfflineIdentity(null)
      }, 'capture'))
      const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' })
      if (logoutError) throw logoutError
      navigate('/iniciar-sesion', { replace: true })
    } catch (cause) {
      setOfflineUser(user.id)
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar sesión.')
    } finally { setClosing(false) }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="font-serif text-3xl font-semibold text-stone-900">
        Ajustes
      </h1>
      <section className="mt-5 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
          CUENTA
        </p>
        <p className="mt-2 text-lg font-medium text-stone-900">{fullName}</p>
        <p className="text-sm text-stone-500">{user?.email}</p>
        <p className="mt-3 text-sm text-stone-600">
          {roleLabel(role)}
          {activeFarm ? ` · ${activeFarm.nombre}` : ''}
        </p>

        <button
          type="button"
          disabled={closing}
          onClick={onLogout}
          className="mt-3 min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover"
        >
          Cerrar sesión
        </button>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>
    </div>
  )
}
