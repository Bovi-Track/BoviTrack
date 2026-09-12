export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72

const SYMBOLS = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `Al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    test: (password: string) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: 'lower',
    label: 'Una letra minúscula',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: 'upper',
    label: 'Una letra mayúscula',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: 'digit',
    label: 'Un número',
    test: (password: string) => /\d/.test(password),
  },
  {
    id: 'symbol',
    label: 'Un símbolo (!@#$%)',
    test: (password: string) => SYMBOLS.test(password),
  },
] as const

export function passwordIssues(
  password: string,
  extras: { username?: string; email?: string } = {},
) {
  const issues: string[] = PASSWORD_RULES.filter(
    (rule) => !rule.test(password),
  ).map((rule) => rule.label)

  if (password.length > MAX_PASSWORD_LENGTH) {
    issues.push(`Máximo ${MAX_PASSWORD_LENGTH} caracteres`)
  }

  const normalized = password.toLowerCase()
  const username = extras.username?.trim().toLowerCase()
  const emailLocal = extras.email?.split('@')[0]?.trim().toLowerCase()

  if (username && username.length >= 3 && normalized.includes(username)) {
    issues.push('No debe incluir tu nombre de usuario')
  }

  if (emailLocal && emailLocal.length >= 3 && normalized.includes(emailLocal)) {
    issues.push('No debe incluir tu correo')
  }

  return issues
}

export function validarPasswordRegistro(
  password: string,
  confirmPassword: string,
  extras: { username?: string; email?: string } = {},
) {
  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden'
  }

  const issues = passwordIssues(password, extras)
  if (issues.length > 0) {
    return `La contraseña no es segura. Falta: ${issues.join(', ').toLowerCase()}.`
  }

  return null
}
