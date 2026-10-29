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

function asWeighings(data: unknown) {
  return (Array.isArray(data) ? data : []).map((row) => {
    const item = row as Weighing
    return { ...item, peso_kg: Number(item.peso_kg) }
  })
}

// RF-UC05-01 y RF-UC06-02: consulta y normaliza los pesajes del hato solicitado.
export async function loadWeighings(bovineIds: string[], farmId: string) {
  if (!bovineIds.length) return [] as Weighing[]
  const allowed = new Set(bovineIds)
  const rows = await cachedRead(`weighings:${farmId}`, farmId, () => fetchWeighings(farmId))
  return rows.filter((item) => allowed.has(item.bovino_id))
}

// Consulta los pesajes autorizados de la finca mediante la RPC de consulta.
async function fetchWeighings(farmId: string) {
  const { data, error } = await supabase
    .rpc('obtener_pesajes_finca', { p_finca_id: farmId })
    .abortSignal(AbortSignal.timeout(8000))

  if (error) throw error
  return asWeighings(data)
}

// RF-UC05-01 y RF-TR-01: valida y conserva un pesaje para sincronizarlo sin duplicados.
// La confirmación online ocurre en procesar_operacion_offline → registrar_pesaje.
export async function saveWeighing(
  payload: PendingWeighing,
  farmId: string,
) {
  if (!Number.isFinite(payload.peso_kg) || payload.peso_kg <= 0 || !isValidIsoDate(payload.fecha_pesaje)) {
    throw new Error('Ingresa un peso positivo y una fecha válida.')
  }
  const peso_kg = Math.round(payload.peso_kg * 100) / 100
  return capture(farmId, 'weighing', { ...payload, peso_kg }, (id): Weighing => ({ id, ...payload, peso_kg }))
}
