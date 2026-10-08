import { bovineGmd } from './gmd.ts'
import { supabase } from './supabase.ts'
import type {
  Bovine,
  CreateBovineInput,
  DashboardMetrics,
  Farm,
  FarmRole,
  PendingWeighing,
  SaleHint,
  Treatment,
  UpdateBovineInput,
  Weighing,
} from '../types/dashboard.ts'

const BOVINE_COLUMNS =
  'id, finca_id, numero_diio, identificador_interno, nombre, raza, color, sexo, estado'

export function bovineErrorMessage(cause: unknown) {
  const error = cause as { code?: string; message?: string } | null
  if (error?.code === '23505') {
    return 'Ya existe un bovino con ese número DIIO o identificador interno.'
  }
  if (error?.message) return error.message
  return 'No se pudo guardar el bovino.'
}

export function weighingErrorMessage(cause: unknown) {
  const error = cause as { message?: string } | null
  if (error?.message) return error.message
  return 'No se pudo guardar el pesaje.'
}

const ACTIVE_FARM_KEY = 'bovitrack-active-farm'
const PENDING_WEIGHS_KEY = 'bovitrack-pending-pesajes'

export function todayIso() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  return name?.trim().toUpperCase() === 'ADMINISTRADOR' ? 'admin' : 'campo'
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
  const { data, error } = await supabase.rpc('obtener_fincas_usuario', {
    p_usuario_id: userId,
  })

  if (error) throw error

  return ((data ?? []) as {
    finca_id: string
    nombre: string
    ubicacion: string | null
    activo: boolean
    rol_id: string
    rol_nombre: string
  }[]).map((row) => ({
    farm: {
      id: row.finca_id,
      nombre: row.nombre,
      ubicacion: row.ubicacion,
      activo: row.activo,
    },
    role: mapRole(row.rol_nombre),
  }))
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
    .select(BOVINE_COLUMNS)
    .eq('finca_id', farmId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Bovine[]
}

export async function createBovine(payload: CreateBovineInput) {
  const created = await createBovines([payload])
  if (!created[0]) throw new Error('No se pudo guardar el bovino.')
  return created[0]
}

export async function createBovines(payloads: CreateBovineInput[]) {
  const { data, error } = await supabase
    .from('bovino')
    .insert(payloads)
    .select(BOVINE_COLUMNS)

  if (error) throw error
  return (data ?? []) as Bovine[]
}

export async function updateBovine(id: string, patch: UpdateBovineInput) {
  const { data, error } = await supabase
    .from('bovino')
    .update(patch)
    .eq('id', id)
    .select(BOVINE_COLUMNS)
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
  const { data, error } = await supabase
    .from('pesaje')
    .insert({
      bovino_id: payload.bovino_id,
      peso_kg: payload.peso_kg,
      fecha_pesaje: payload.fecha_pesaje,
      registrado_por: userId ?? null,
      es_inicial: false,
    })
    .select('id, bovino_id, peso_kg, fecha_pesaje')
    .single()
  if (error) throw error
  return {
    ...data,
    peso_kg: Number(data.peso_kg),
  } as Weighing
}

export async function loadTasks(farmId: string) {
  const { data, error } = await supabase.rpc('obtener_tareas_finca', {
    p_finca_id: farmId,
  })

  if (error) throw error
  return (data ?? []) as any[]
}

export async function createTask(
  farmId: string,
  titulo: string,
  descripcion: string | null,
  fecha_limite: string | null,
  asignadaA: string | null,
) {
  const { data, error } = await supabase.rpc('crear_tarea_finca', {
    p_finca_id: farmId,
    p_titulo: titulo,
    p_descripcion: descripcion,
    p_fecha_limite: fecha_limite,
    p_asignada_a: asignadaA,
  })
  if (error) throw error
  return data
}

export async function updateTaskDone(id: string, done: boolean) {
  const { error } = await supabase.rpc('marcar_tarea_estado', {
    p_id: id,
    p_estado: done ? 'COMPLETADA' : 'PENDIENTE',
  })
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

export async function loadSanitaryRecords(farmId: string) {
  const { data, error } = await supabase.rpc('obtener_registros_sanitarios_finca', {
    p_finca_id: farmId,
  })
  if (error) throw error
  return data ?? []
}

export async function createSanitaryRecord(
  bovinoId: string,
  tipo: string,
  producto: string,
  dosis: string,
  fecha: string,
  proxima: string | null,
  responsable: string | null,
  observaciones: string | null,
) {
  const { data, error } = await supabase.rpc('registrar_aplicacion_sanitaria', {
    p_bovino_id: bovinoId,
    p_tipo: tipo,
    p_producto: producto,
    p_dosis: dosis,
    p_fecha_aplicacion: fecha,
    p_proxima_aplicacion: proxima,
    p_responsable: responsable,
    p_observaciones: observaciones,
  })
  if (error) throw error
  return data
}

export async function removeSanitaryRecord(id: string) {
  const { error } = await supabase.rpc('eliminar_registro_sanitario', { p_id: id })
  if (error) throw error
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
  const weeklyGmds: number[] = []
  for (const bovine of active) {
    const gmd = bovineGmd(byBovine.get(bovine.id) ?? [])
    if (gmd.lifetime != null) gmds.push(gmd.lifetime)
    if (gmd.weekly != null) weeklyGmds.push(gmd.weekly)
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
    weeklyGmd:
      weeklyGmds.length > 0
        ? weeklyGmds.reduce((sum, value) => sum + value, 0) / weeklyGmds.length
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
  if (bovine.nombre) return `${bovine.nombre} · ${bovine.identificador_interno}`
  if (bovine.numero_diio) {
    return `${bovine.identificador_interno} · DIIO ${bovine.numero_diio}`
  }
  return bovine.identificador_interno
}
