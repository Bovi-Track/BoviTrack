import { Lock, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { iniciarSesion, mensajeAuth } from '../lib/auth.ts'

export default function LoginPage() {
  const { user, loading, passwordRecovery } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user && !passwordRecovery) {
    return <Navigate to="/inicio" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: signInError } = await iniciarSesion(
      identifier,
      password,
      rememberMe,
    )

    setSubmitting(false)

    if (signInError) {
      setError(mensajeAuth(signInError.message))
      return
    }

    navigate('/inicio', { replace: true })
  }

  return (
    <AuthLayout brandIcon="arrow">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Bienvenido de nuevo
        </h1>
        <p className="mt-2 text-stone-500">Inicia sesión en tu cuenta</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm"
      >
        <div className="space-y-4">
          <AuthField
            id="identifier"
            label="Correo o nombre de usuario"
            type="text"
            autoComplete="username"
            placeholder="tú@ejemplo.com o usuario"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            icon={<User className="size-4" strokeWidth={1.75} />}
          />
          <AuthField
            id="password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            icon={<Lock className="size-4" strokeWidth={1.75} />}
            labelExtra={
              <Link
                to="/olvidar-contrasena"
                state={{ identifier }}
                className="self-start text-xs text-stone-400 transition hover:text-bovi sm:self-auto sm:text-sm"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            }
          />
        </div>

        <label
          htmlFor="remember-me"
          className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-stone-600"
        >
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="size-4 cursor-pointer rounded border-stone-300 text-bovi accent-bovi"
          />
          Recuérdame
        </label>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full cursor-pointer rounded-xl bg-bovi py-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        ¿No tienes una cuenta?{' '}
        <Link to="/registro" className="font-medium text-bovi hover:underline">
          Crea una
        </Link>
      </p>
    </AuthLayout>
  )
}
