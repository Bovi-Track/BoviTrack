import { supabase } from './supabase.ts'
import type {
  Bovine,
  DashboardMetrics,
  Farm,
  FarmRole,
  PendingWeighing,
  SaleHint,
  Task,
  Treatment,
  Weighing,
} from '../types/dashboard.ts'

const ACTIVE_FARM_KEY = 'bovitrack-active-farm'
const PENDING_WEIGHS_KEY = 'bovitrack-pending-pesajes'

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function greetingForNow(name: string) {
  const hour = new Date().getHours()
  const hello =
    hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  return `${hello}, ${name}`
}

export function roleLabel(role: FarmRole) {
  return role === 'admin' ? 'Administrador de Finca' : 'Personal de Campo'
}

export function mapRole(name: string | null | undefined): FarmRole {
  const value = name?.toLowerCase() ?? ''
  if (value.includes('campo') || value.includes('personal')) return 'campo'
  return 'admin'
}

export function getStoredFarmId() {
  return localStorage.getItem(ACTIVE_FARM_KEY)
}

export function storeFarmId(id: string | null) {
  if (!id) {
    localStorage.removeItem(ACTIVE_FARM_KEY)
    return
  }
  localStorage.setItem(ACTIVE_FARM_KEY, id)
}

export function readPendingWeighings(): PendingWeighing[] {
  try {
    const raw = localStorage.getItem(PENDING_WEIGHS_KEY)
    return raw ? (JSON.parse(raw) as PendingWeighing[]) : []
  } catch {
    return []
  }
}

export function writePendingWeighings(items: PendingWeighing[]) {
  localStorage.setItem(PENDING_WEIGHS_KEY, JSON.stringify(items))
}

export async function loadUserFarms(userId: string) {
  const { data, error } = await supabase
    .from('usuario_finca')
    .select('finca_id, roles(nombre), finca(id, nombre, ubicacion, activo)')
    .eq('usuario_id', userId)

  if (error) throw error

  const farms: { farm: Farm; role: FarmRole }[] = []
  for (const row of data ?? []) {
    const farm = row.finca as Farm | Farm[] | null
    const resolved = Array.isArray(farm) ? farm[0] : farm
    if (!resolved) continue
    const roles = row.roles as { nombre: string } | { nombre: string }[] | null
    const roleName = Array.isArray(roles) ? roles[0]?.nombre : roles?.nombre
    farms.push({ farm: resolved, role: mapRole(roleName) })
  }
  return farms
}

export async function createFarm(nombre: string, ubicacion: string) {
  const { data, error } = await supabase.rpc('crear_finca', {
    p_nombre: nombre,
    p_ubicacion: ubicacion,
  })
  if (error) throw error
  return data as Farm
}

export async function loadBovines(farmId: string) {
  const { data, error } = await supabase
    .from('bovino')
    .select(
      'id, finca_id, numero_diio, identificador_interno, nombre, raza, sexo, estado',
    )
    .eq('finca_id', farmId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Bovine[]
}

export async function createBovine(payload: {
  finca_id: string
  numero_diio: string
  identificador_interno: string
  nombre: string | null
  raza: string | null
  color: string | null
  sexo: 'MACHO' | 'HEMBRA'
  fecha_nacimiento: string | null
  fecha_ingreso: string
  precio_compra_kilo: number | null
  costo_flete_asignado: number
  estado: Bovine['estado']
  compra_id: string | null
}) {
  const { data, error } = await supabase
    .from('bovino')
    .insert(payload)
    .select(
      'id, finca_id, numero_diio, identificador_interno, nombre, raza, sexo, estado',
    )
    .single()

  if (error) throw error
  return data as Bovine
}

export async function loadWeighings(bovineIds: string[]) {
  if (bovineIds.length === 0) return [] as Weighing[]
  const { data, error } = await supabase
    .from('pesaje')
    .select('id, bovino_id, peso_kg, fecha_pesaje')
    .in('bovino_id', bovineIds)
    .order('fecha_pesaje', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    peso_kg: Number(row.peso_kg),
  })) as Weighing[]
}

export async function saveWeighing(
  payload: PendingWeighing,
  userId: string | undefined,
) {
  const { error } = await supabase.from('pesaje').insert({
    bovino_id: payload.bovino_id,
    peso_kg: payload.peso_kg,
    fecha_pesaje: payload.fecha_pesaje,
    registrado_por: userId ?? null,
    es_inicial: false,
  })
  if (error) throw error
}

export async function loadTasks(farmId: string, userId: string) {
  const { data, error } = await supabase
    .from('tarea_campo')
    .select('id, titulo, descripcion, estado, fecha_limite')
    .eq('finca_id', farmId)
    .or(`asignada_a.eq.${userId},asignada_a.is.null`)
    .order('fecha_limite', { ascending: true })

  if (error) throw error
  return (data ?? []) as Task[]
}

export async function updateTaskDone(id: string, done: boolean) {
  const { error } = await supabase
    .from('tarea_campo')
    .update({ estado: done ? 'COMPLETADA' : 'PENDIENTE' })
    .eq('id', id)
  if (error) throw error
}

export async function loadTreatments(bovineIds: string[]) {
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

export function computeMetrics(
  bovines: Bovine[],
  weighings: Weighing[],
  treatments: Treatment[],
): DashboardMetrics {
  const active = bovines.filter((item) => item.estado === 'ACTIVO')
  const byBovine = new Map<string, Weighing[]>()
  for (const weigh of weighings) {
    const list = byBovine.get(weigh.bovino_id) ?? []
    list.push(weigh)
    byBovine.set(weigh.bovino_id, list)
  }

  const gmds: number[] = []
  for (const bovine of active) {
    const list = byBovine.get(bovine.id) ?? []
    if (list.length < 2) continue
    const first = list[0]
    const last = list[list.length - 1]
    const days =
      (new Date(last.fecha_pesaje).getTime() -
        new Date(first.fecha_pesaje).getTime()) /
      86_400_000
    if (days <= 0) continue
    gmds.push((last.peso_kg - first.peso_kg) / days)
  }

  const today = todayIso()
  const pendingAlerts = treatments.filter((item) => {
    if (!item.proxima_aplicacion) return false
    return item.proxima_aplicacion <= today
  }).length

  return {
    activeBulls: active.length,
    averageGmd:
      gmds.length > 0
        ? gmds.reduce((sum, value) => sum + value, 0) / gmds.length
        : null,
    pendingAlerts,
  }
}

export function saleHints(bovines: Bovine[], weighings: Weighing[]): SaleHint[] {
  const byBovine = new Map<string, Weighing[]>()
  for (const weigh of weighings) {
    const list = byBovine.get(weigh.bovino_id) ?? []
    list.push(weigh)
    byBovine.set(weigh.bovino_id, list)
  }

  return bovines
    .filter((item) => item.estado === 'ACTIVO')
    .slice(0, 6)
    .map((bovine) => {
      const list = byBovine.get(bovine.id) ?? []
      if (list.length < 2) {
        return {
          bovine,
          status: 'falta' as const,
          detail: 'Faltan pesajes para evaluar',
        }
      }
      const first = list[0]
      const last = list[list.length - 1]
      const days =
        (new Date(last.fecha_pesaje).getTime() -
          new Date(first.fecha_pesaje).getTime()) /
        86_400_000
      const gmd = days > 0 ? (last.peso_kg - first.peso_kg) / days : 0
      if (last.peso_kg >= 420 && gmd >= 0.8) {
        return {
          bovine,
          status: 'apto' as const,
          detail: `${last.peso_kg.toFixed(0)} kg · GMD ${gmd.toFixed(2)}`,
        }
      }
      return {
        bovine,
        status: 'mantener' as const,
        detail: `${last.peso_kg.toFixed(0)} kg · seguir engorde`,
      }
    })
}

export function bovineLabel(bovine: Pick<Bovine, 'nombre' | 'numero_diio' | 'identificador_interno'>) {
  return bovine.nombre
    ? `${bovine.nombre} · ${bovine.identificador_interno}`
    : `${bovine.identificador_interno} · DIIO ${bovine.numero_diio}`
}
