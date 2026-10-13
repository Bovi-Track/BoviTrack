import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { useFarm } from '../context/useFarm.ts'
import { roleLabel } from '../lib/farms.ts'
import { supabase } from '../lib/supabase.ts'

// RF-UC14-01: presenta la identidad, rol de finca y acción de cierre de sesión.
export default function SettingsPage() {
  const { user } = useAuth()
  const { activeFarm, role } = useFarm()
  const navigate = useNavigate()
  const fullName =
    typeof user?.user_metadata.nombre_completo === 'string'
      ? user.user_metadata.nombre_completo
      : user?.email

  // RF-UC14-01 (parcial): cierra la sesión; la limpieza de datos offline sigue pendiente.
  async function onLogout() {
    await supabase.auth.signOut()
    navigate('/iniciar-sesion', { replace: true })
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
          onClick={onLogout}
          className="mt-3 min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover"
        >
          Cerrar sesión
        </button>
      </section>
    </div>
  )
}
