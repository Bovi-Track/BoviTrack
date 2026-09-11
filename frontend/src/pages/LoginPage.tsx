import { Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthField } from '../components/auth/AuthField.tsx'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { AuthSocialBlock } from '../components/auth/AuthSocialBlock.tsx'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            icon={<Lock className="size-4" strokeWidth={1.75} />}
            labelExtra={
              <button
                type="button"
                className="cursor-pointer self-start text-xs text-stone-400 transition hover:text-bovi sm:self-auto sm:text-sm"
              >
                ¿Olvidaste tu contraseña?
              </button>
            }
          />
        </div>

        <button
          type="submit"
          className="mt-6 w-full cursor-pointer rounded-xl bg-bovi py-3 text-sm font-medium text-white transition hover:bg-bovi-hover"
        >
          Iniciar sesión
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        ¿No tienes una cuenta?{' '}
        <Link
          to="/registro"
          className="font-medium text-bovi hover:underline"
        >
          Crea una
        </Link>
      </p>
    </AuthLayout>
  )
}
