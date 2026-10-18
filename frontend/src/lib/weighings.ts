import { supabase } from './supabase.ts'
import { cachedRead, capture } from '../offline/runtime.ts'
import { isValidIsoDate } from './dates.ts'
import type { PendingWeighing, Weighing } from '../types/dashboard.ts'

const PENDING_WEIGHS_KEY = 'bovitrack-pending-pesajes'

// Obtiene un mensaje de error de pesaje conservando el detalle disponible.
export function weighingErrorMessage(cause: unknown) {
  const error = cause as { message?: string } | null
  if (error?.message) return error.message
  return 'No se pudo guardar el pesaje.'
}

// RF-TR-01 (parcial): lee la cola heredada de pesajes en localStorage.
// Esta cola aún no está aislada por usuario/finca ni tiene identificadores idempotentes.
export function readPendingWeighings(): PendingWeighing[] {
  try {
    const raw = localStorage.getItem(PENDING_WEIGHS_KEY)
    return raw ? (JSON.parse(raw) as PendingWeighing[]) : []
  } catch {
    return []
  }
}

// RF-TR-01 (parcial): persiste la cola heredada de pesajes pendientes.
export function writePendingWeighings(items: PendingWeighing[]) {
  localStorage.setItem(PENDING_WEIGHS_KEY, JSON.stringify(items))
}

// RF-UC05-01 y RF-UC06-02: consulta y normaliza los pesajes del hato solicitado.
export async function loadWeighings(bovineIds: string[], farmId: string) {
  if (!bovineIds.length) return [] as Weighing[]
  const ids = [...bovineIds].sort()
  return cachedRead(`weighings:${ids.join(',')}`, farmId, () => fetchWeighings(ids))
}

// Consulta los pesajes online y normaliza los valores numéricos de PostgreSQL.
async function fetchWeighings(bovineIds: string[]) {
  if (bovineIds.length === 0) return [] as Weighing[]
  const { data, error } = await supabase
    .from('pesaje')
    .select('id, bovino_id, peso_kg, fecha_pesaje')
    .in('bovino_id', bovineIds)
    .order('fecha_pesaje', { ascending: true })
    .retry(false)
    .abortSignal(AbortSignal.timeout(8000))

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    peso_kg: Number(row.peso_kg),
  })) as Weighing[]
}

// RF-UC05-01 y RF-TR-01: valida y conserva un pesaje para sincronizarlo sin duplicados.
export async function saveWeighing(
  payload: PendingWeighing,
  farmId: string,
) {
  if (!Number.isFinite(payload.peso_kg) || payload.peso_kg <= 0 || !isValidIsoDate(payload.fecha_pesaje)) {
    throw new Error('Ingresa un peso positivo y una fecha válida.')
  }
  return capture(farmId, 'weighing', payload, (id): Weighing => ({ id, ...payload }))
}
