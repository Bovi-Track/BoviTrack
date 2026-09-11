import { Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthField } from '../components/auth/AuthField.tsx'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { AuthSocialBlock } from '../components/auth/AuthSocialBlock.tsx'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    setError('')
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
        <AuthSocialBlock />

        <div className="space-y-4">
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
            minLength={6}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            icon={<Lock className="size-4" strokeWidth={1.75} />}
          />
          <AuthField
            id="confirm-password"
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={6}
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
          className="mt-6 w-full cursor-pointer rounded-xl bg-bovi py-3 text-sm font-medium text-white transition hover:bg-bovi-hover"
        >
          Crear cuenta
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
