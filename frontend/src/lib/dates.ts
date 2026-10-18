// Devuelve la fecha local de hoy como YYYY-MM-DD, sin convertirla a UTC.
export function todayIso() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Interpreta una fecha YYYY-MM-DD como fecha de calendario local.
export function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

// Serializa una fecha local como YYYY-MM-DD.
export function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Calcula la diferencia de días entre dos fechas de calendario.
export function daysBetween(fromIso: string, toIso: string) {
  const from = parseIsoDate(fromIso)
  const to = parseIsoDate(toIso)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

// Desplaza una fecha de calendario y devuelve YYYY-MM-DD.
export function addDays(iso: string, days: number) {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

// Presenta YYYY-MM-DD como DD/MM/YYYY para las tablas del PDF.
export function formatDate(iso: string) {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

// Presenta una fecha en español; el año puede omitirse en listas compactas.
export function formatDayLong(iso: string, includeYear = true) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-CR', {
    day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' as const } : {}),
  })
}
// Comprueba formato ISO y fecha real sin aceptar días inexistentes.
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(y, m - 1, d)
  return y > 0 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}
