import { addDays, isValidIsoDate, todayIso } from './dates.ts'
import {
  SANITARY_KINDS,
  type PlanStatus,
  type SanitaryKind,
  type SanitaryRecord,
} from '../types/sanitary.ts'
import { supabase } from './supabase.ts'
import { cachedRead, capture, requireConnection } from '../offline/runtime.ts'
import type { Treatment } from '../types/dashboard.ts'

// RF-UC07-02: consulta próximas aplicaciones para el hato; conserva el límite actual de 12.
export async function loadTreatments(bovineIds: string[], farmId: string) {
  if (!bovineIds.length) return [] as Treatment[]
  const ids = [...bovineIds].sort()
  return cachedRead(`treatments:${ids.join(',')}`, farmId, () => fetchTreatments(ids))
}

// Consulta las próximas aplicaciones y adapta la relación con el toro.
async function fetchTreatments(bovineIds: string[]) {
  if (bovineIds.length === 0) return [] as Treatment[]
  const { data, error } = await supabase
    .from('registro_sanitario')
    .select(
      'id, bovino_id, proxima_aplicacion, observaciones, bovino:bovino_id(nombre, numero_diio, identificador_interno)',
    )
    .in('bovino_id', bovineIds)
    .not('proxima_aplicacion', 'is', null)
    .order('proxima_aplicacion', { ascending: true })
    .limit(12)
    .retry(false)
    .abortSignal(AbortSignal.timeout(8000))

  if (error) throw error
  return (data ?? []).map((row) => {
    const related = row.bovino
    const bovine = Array.isArray(related) ? related[0] : related
    return {
      id: row.id,
      bovino_id: row.bovino_id,
      proxima_aplicacion: row.proxima_aplicacion,
      observaciones: row.observaciones,
      bovino: bovine ?? undefined,
    }
  }) as Treatment[]
}

// RF-UC07-01: consulta el historial sanitario devuelto por la RPC de la finca.
export async function loadSanitaryRecords(farmId: string) {
  return cachedRead(`sanitary:${farmId}`, farmId, () => fetchSanitaryRecords(farmId))
}

// Consulta el historial sanitario autorizado de la finca en Supabase.
async function fetchSanitaryRecords(farmId: string) {
  const { data, error } = await supabase.rpc('obtener_registros_sanitarios_finca', {
    p_finca_id: farmId,
  })
  if (error) throw error
  return (data ?? []) as SanitaryRecord[]
}

// RF-UC07-01: solicita registrar producto, dosis, fechas y responsable de una aplicación.
export async function createSanitaryRecord(
  bovinoId: string,
  tipo: SanitaryKind,
  producto: string,
  dosis: string,
  fecha: string,
  proxima: string | null,
  responsable: string | null,
  observaciones: string | null,
  farmId: string,
) {
  if (!producto.trim() || !SANITARY_KINDS.includes(tipo) || !Number.isFinite(Number(dosis)) ||
    Number(dosis) <= 0 || !isValidIsoDate(fecha) || (proxima && !isValidIsoDate(proxima))) {
    throw new Error('Completa producto, dosis positiva y fechas válidas.')
  }
  return capture(farmId, 'sanitary', {
    bovino_id: bovinoId, tipo, producto, dosis, fecha, proxima, observaciones,
  }, (id): SanitaryRecord => ({
    id, bovino_id: bovinoId, tipo, producto, dosis, fecha, proxima: proxima ?? '',
    responsable: responsable ?? 'Pendiente de confirmar', observaciones: observaciones ?? '',
  }))
}

// RF-UC07-01 (desviación pendiente): solicita el borrado sanitario heredado.
// Debe revisarse para conservar el historial exigido por la trazabilidad.
export async function removeSanitaryRecord(id: string) {
  requireConnection()
  const { error } = await supabase.rpc('eliminar_registro_sanitario', { p_id: id })
  if (error) throw error
}

// Selecciona la aplicación más reciente de un tipo sanitario.
export function latestOf(records: SanitaryRecord[], tipo: SanitaryKind) {
  return records
    .filter((item) => item.tipo === tipo)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
}

// Clasifica la próxima aplicación como vencida, próxima, al día o sin programación.
export function planStatus(record: SanitaryRecord | undefined): PlanStatus {
  if (!record) return 'vacio'
  if (!record.proxima) return 'sin_proxima'
  const today = todayIso()
  if (record.proxima < today) return 'vencido'
  if (record.proxima <= addDays(today, 14)) return 'proximo'
  return 'aldia'
}

// Resume el estado sanitario del toro priorizando vencimientos y próximas aplicaciones.
export function worstStatus(records: SanitaryRecord[]): PlanStatus {
  const statuses = SANITARY_KINDS.map((kind) => planStatus(latestOf(records, kind)))
  if (statuses.includes('vencido')) return 'vencido'
  if (statuses.includes('proximo')) return 'proximo'
  if (statuses.includes('aldia') || statuses.includes('sin_proxima')) return 'aldia'
  return 'vacio'
}
