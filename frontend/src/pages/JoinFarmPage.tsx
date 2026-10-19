import { clearPendingInvite, savePendingInvite } from '../lib/pending-invite.ts'
import { CheckCircle2, Loader2, LogIn, Tractor, UserPlus, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.ts'
import { acceptFarmInvitation } from '../lib/farms.ts'

type State =
  | { status: 'loading' }
  | { status: 'success'; farmName: string }
  | { status: 'error'; message: string }
  | { status: 'needs-auth'; token: string; farmName?: string }

// RF-UC15-02: coordina autenticación y aceptación del enlace de invitación a una finca.
export default function JoinFarmPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const attemptKey = `${user?.id ?? ''}:${token}`
  const [result, setResult] = useState<{ key: string; state: State } | null>(null)
  const attempted = useRef<{ key: string; request: ReturnType<typeof acceptFarmInvitation> } | null>(null)
  const state: State = authLoading ? { status: 'loading' }
    : !token ? { status: 'error', message: 'El enlace de invitación no contiene un token válido.' }
      : !user ? { status: 'needs-auth', token }
        : result?.key === attemptKey ? result.state : { status: 'loading' }

  useEffect(() => {
    if (authLoading || !token) return

    if (!user) {
      // Guardar token para despues del login/registro
      savePendingInvite(token)
      return
    }

    if (attempted.current?.key !== attemptKey) {
      attempted.current = { key: attemptKey, request: acceptFarmInvitation(token) }
    }
    const request = attempted.current.request
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    void (async () => {
      try {
        const farm = await request
        if (!active) return
        clearPendingInvite(token)
        setResult({ key: attemptKey, state: { status: 'success', farmName: farm.nombre } })
        timer = setTimeout(() => navigate('/inicio', { replace: true }), 2500)
      } catch (err) {
        if (active) setResult({ key: attemptKey, state: {
          status: 'error', message: err instanceof Error ? err.message : 'No se pudo procesar la invitación.',
        } })
      }
    })()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [authLoading, user, token, attemptKey, navigate])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-bovi shadow-lg shadow-bovi/30">
            <Tractor className="size-7 text-white" strokeWidth={1.6} />
          </div>
          <span className="font-serif text-xl font-semibold text-stone-900">BoviTrack</span>
        </div>

        <div className="rounded-3xl border border-stone-200/80 bg-white p-7 shadow-sm text-center">
          {state.status === 'loading' && (
            <>
              <Loader2 className="mx-auto mb-3 size-10 animate-spin text-bovi" />
              <p className="font-serif text-lg font-semibold text-stone-900">Procesando invitación…</p>
              <p className="mt-1 text-sm text-stone-500">Un momento, estamos verificando el enlace.</p>
            </>
          )}

          {state.status === 'success' && (
            <>
              <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
              <p className="font-serif text-lg font-semibold text-stone-900">
                ¡Bienvenido a {state.farmName}!
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Ya formas parte del equipo. Redirigiendo al inicio…
              </p>
            </>
          )}

          {state.status === 'error' && (
            <>
              <XCircle className="mx-auto mb-3 size-12 text-red-500" />
              <p className="font-serif text-lg font-semibold text-stone-900">Enlace invalido</p>
              <p className="mt-1 text-sm text-stone-500">{state.message}</p>
              <Link
                to="/inicio"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-bovi px-5 py-2.5 text-sm font-medium text-white transition hover:bg-bovi-hover"
              >
                Ir al inicio
              </Link>
            </>
          )}

          {state.status === 'needs-auth' && (
            <>
              <Tractor className="mx-auto mb-3 size-12 text-bovi" />
              <p className="font-serif text-lg font-semibold text-stone-900">
                Te invitaron a una finca
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Inicia sesión o crea una cuenta para aceptar la invitación.
                El enlace quedará guardado automáticamente.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  to={`/iniciar-sesion?next=${encodeURIComponent(`/unirse?token=${state.token}`)}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-bovi px-5 py-3 text-sm font-medium text-white transition hover:bg-bovi-hover"
                >
                  <LogIn className="size-4" />
                  Iniciar sesión
                </Link>
                <Link
                  to={`/registro?next=${encodeURIComponent(`/unirse?token=${state.token}`)}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-cream px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  <UserPlus className="size-4" />
                  Crear cuenta nueva
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
