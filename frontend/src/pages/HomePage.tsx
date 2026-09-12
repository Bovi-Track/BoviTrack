import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { supabase } from '../lib/supabase.ts'

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const metadata = user?.user_metadata ?? {}
  const fullName =
    typeof metadata.nombre_completo === 'string'
      ? metadata.nombre_completo
      : user?.email
  const username =
    typeof metadata.username === 'string' ? metadata.username : null

  async function onLogout() {
    await supabase.auth.signOut()
    navigate('/iniciar-sesion', { replace: true })
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-cream px-6">
      <div className="w-full max-w-md rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm">
        <p className="text-[11px] font-medium tracking-[0.2em] text-stone-500">
          BOVITRACK
        </p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-stone-900">
          Hola{fullName ? `, ${fullName}` : ''}
        </h1>
        <p className="mt-2 text-stone-500">Ya iniciaste sesión.</p>
        <dl className="mt-6 space-y-2 text-sm text-stone-600">
          {username ? (
            <div>
              <dt className="font-medium text-stone-800">Usuario</dt>
              <dd>{username}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-stone-800">Correo</dt>
            <dd>{user?.email}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onLogout}
          className="mt-6 w-full cursor-pointer rounded-xl bg-bovi py-3 text-sm font-medium text-white transition hover:bg-bovi-hover"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
