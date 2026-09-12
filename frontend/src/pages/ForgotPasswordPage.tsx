import { User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { mensajeAuth, solicitarRestablecimiento } from '../lib/auth.ts'

export default function ForgotPasswordPage() {
  const { user, loading, passwordRecovery } = useAuth()
  const location = useLocation()
  const prefilled =
    typeof location.state === 'object' &&
    location.state &&
    'identifier' in location.state &&
    typeof location.state.identifier === 'string'
      ? location.state.identifier
      : ''
  const [identifier, setIdentifier] = useState(prefilled)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user && !passwordRecovery) {
    return <Navigate to="/inicio" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    const { error: resetError } = await solicitarRestablecimiento(identifier)

    setSubmitting(false)

    if (resetError) {
      setError(mensajeAuth(resetError.message))
      return
    }

    setInfo(
      'Si existe una cuenta con esos datos, te enviamos un correo para restablecer la contraseña.',
    )
  }

  return (
    <AuthLayout brandIcon="arrow">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="mt-2 text-stone-500">
          Ingresa tu correo o nombre de usuario y te enviaremos un enlace.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm"
      >
        <AuthField
          id="identifier"
          label="Correo o nombre de usuario"
          type="text"
          autoComplete="username"
          placeholder="tú@ejemplo.com o usuario"
          required
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value)
            setError('')
            setInfo('')
          }}
          icon={<User className="size-4" strokeWidth={1.75} />}
        />

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {info ? (
          <p className="mt-3 text-sm text-bovi" role="status">
            {info}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full cursor-pointer rounded-xl bg-bovi py-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        <Link
          to="/iniciar-sesion"
          className="font-medium text-bovi hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
