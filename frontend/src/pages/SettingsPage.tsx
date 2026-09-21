import { FileText } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import { roleLabel } from '../lib/dashboard.ts'
import { supabase } from '../lib/supabase.ts'

export default function SettingsPage() {
  const { user } = useAuth()
  const { activeFarm, role } = useFarm()
  const navigate = useNavigate()
  const fullName =
    typeof user?.user_metadata.nombre_completo === 'string'
      ? user.user_metadata.nombre_completo
      : user?.email

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
        <Link
          to="/reporte"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 text-sm font-medium text-stone-800 transition hover:bg-cream"
        >
          <FileText className="size-4 text-bovi" />
          Generar reporte PDF
        </Link>
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
