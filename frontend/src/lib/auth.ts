import { validarPasswordRegistro } from './passwordPolicy.ts'
import { supabase, setRememberMe } from './supabase.ts'

export function looksLikeEmail(value: string) {
  return value.includes('@')
}

export async function resolveEmail(identifier: string) {
  const value = identifier.trim()
  if (looksLikeEmail(value)) {
    return value
  }

  const { data, error } = await supabase.rpc('correo_por_username', {
    p_username: value,
  })

  if (error || typeof data !== 'string' || !data) {
    return null
  }

  return data
}

export async function registrarUsuario(
  email: string,
  password: string,
  nombreCompleto: string,
  username: string,
  confirmPassword = password,
) {
  const passwordError = validarPasswordRegistro(password, confirmPassword, {
    email,
    username,
  })

  if (passwordError) {
    return {
      data: { user: null, session: null },
      error: { message: passwordError },
    }
  }

  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        nombre_completo: nombreCompleto.trim(),
        username: username.trim(),
      },
      emailRedirectTo: `${window.location.origin}/iniciar-sesion`,
    },
  })
}

export async function iniciarSesion(
  identifier: string,
  password: string,
  rememberMe: boolean,
) {
  setRememberMe(rememberMe)

  const email = await resolveEmail(identifier)
  if (!email) {
    return {
      data: { user: null, session: null },
      error: { message: 'Correo, usuario o contraseña incorrectos' },
    }
  }

  return supabase.auth.signInWithPassword({ email, password })
}

export function recoveryRedirectUrl() {
  return `${window.location.origin}/restablecer-contrasena`
}

export async function solicitarRestablecimiento(identifier: string) {
  const email = await resolveEmail(identifier)

  if (email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectUrl(),
    })

    if (error) {
      return { error }
    }
  }

  return { error: null }
}

export async function actualizarPassword(
  password: string,
  confirmPassword: string,
) {
  const passwordError = validarPasswordRegistro(password, confirmPassword)

  if (passwordError) {
    return { error: { message: passwordError } }
  }

  return supabase.auth.updateUser({ password })
}

export function mensajeAuth(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Correo, usuario o contraseña incorrectos'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión'
  }
  if (normalized.includes('user already registered')) {
    return 'Este correo ya está registrado'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo'
  }
  if (normalized.includes('redirect')) {
    return 'El enlace de recuperación no está permitido. Revisa las URL de redirección en Supabase.'
  }
  if (normalized.includes('weak') || normalized.includes('password should')) {
    return 'La contraseña no cumple los requisitos de seguridad'
  }
  if (normalized.includes('password')) {
    return message
  }

  return message
}
