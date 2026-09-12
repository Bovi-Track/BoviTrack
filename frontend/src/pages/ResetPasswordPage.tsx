import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { PasswordRules } from '../components/auth/PasswordRules.tsx'
import { actualizarPassword, mensajeAuth } from '../lib/auth.ts'
import {
  MIN_PASSWORD_LENGTH,
  validarPasswordRegistro,
} from '../lib/passwordPolicy.ts'

export default function ResetPasswordPage() {
  const { user, loading, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const passwordError = validarPasswordRegistro(password, confirmPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setError('')
    setSubmitting(true)

    const { error: updateError } = await actualizarPassword(
      password,
      confirmPassword,
    )

    setSubmitting(false)

    if (updateError) {
      setError(mensajeAuth(updateError.message))
      return
    }

    clearPasswordRecovery()
    navigate('/inicio', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-cream text-stone-500">
        Cargando…
      </div>
    )
  }

  if (!user) {
    return (
      <AuthLayout brandIcon="arrow">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Enlace no válido
          </h1>
          <p className="mt-2 text-stone-500">
            El enlace expiró o ya se usó. Solicita uno nuevo para continuar.
          </p>
        </header>
        <Link
          to="/olvidar-contrasena"
          className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-bovi py-3 text-sm font-medium text-white transition hover:bg-bovi-hover"
        >
          Solicitar nuevo enlace
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout brandIcon="arrow">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Nueva contraseña
        </h1>
        <p className="mt-2 text-stone-500">
          Elige una contraseña segura para tu cuenta.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm"
      >
        <div className="space-y-4">
          <AuthField
            id="password"
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={72}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            icon={<Lock className="size-4" strokeWidth={1.75} />}
            hint={<PasswordRules password={password} />}
          />
          <AuthField
            id="confirm-password"
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={72}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              setError('')
            }}
            icon={<Lock className="size-4" strokeWidth={1.75} />}
          />
        </div>

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
          {submitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthLayout>
  )
}
