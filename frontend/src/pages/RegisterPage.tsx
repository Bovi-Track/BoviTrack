import { AtSign, Lock, Mail, User } from 'lucide-react'
import { useState, type SubmitEventHandler } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { PasswordRules } from '../components/auth/PasswordRules.tsx'
import { mensajeAuth, registrarUsuario } from '../lib/auth.ts'
import {
  MIN_PASSWORD_LENGTH,
  validarPasswordRegistro,
} from '../lib/passwordPolicy.ts'

export default function RegisterPage() {
  const { user, loading, passwordRecovery } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user && !passwordRecovery) {
    return <Navigate to="/inicio" replace />
  }

  const onSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    const passwordError = validarPasswordRegistro(password, confirmPassword, {
      email,
      username,
    })
    if (passwordError) {
      setError(passwordError)
      return
    }

    setError('')
    setInfo('')
    setSubmitting(true)

    const { data, error: signUpError } = await registrarUsuario(
      email,
      password,
      fullName,
      username,
      confirmPassword,
    )

    setSubmitting(false)

    if (signUpError) {
      setError(mensajeAuth(signUpError.message))
      return
    }

    if (data.session) {
      navigate('/inicio', { replace: true })
      return
    }

    setInfo('Revisa tu correo para confirmar la cuenta e inicia sesión.')
  }

  return (
    <AuthLayout brandIcon="user">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Crea tu cuenta
        </h1>
        <p className="mt-2 text-stone-500">Regístrate para comenzar</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm"
      >
        <div className="space-y-4">
          <AuthField
            id="full-name"
            label="Nombre completo"
            type="text"
            autoComplete="name"
            placeholder="Ana Pérez"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            icon={<User className="size-4" strokeWidth={1.75} />}
          />
          <AuthField
            id="username"
            label="Nombre de usuario"
            type="text"
            autoComplete="username"
            placeholder="anaperez"
            required
            minLength={3}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            icon={<AtSign className="size-4" strokeWidth={1.75} />}
          />
          <AuthField
            id="email"
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="tú@ejemplo.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            icon={<Mail className="size-4" strokeWidth={1.75} />}
          />
          <AuthField
            id="password"
            label="Contraseña"
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
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        ¿Ya tienes una cuenta?{' '}
        <Link
          to="/iniciar-sesion"
          className="font-medium text-bovi hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
