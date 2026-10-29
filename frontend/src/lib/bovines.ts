import { supabase } from './supabase.ts'
import { cachedRead, requireConnection } from '../offline/runtime.ts'
import type { Bovine, CreateBovineInput, UpdateBovineInput } from '../types/dashboard.ts'

// Traduce errores de unicidad o guardado del toro a mensajes de interfaz.
export function bovineErrorMessage(cause: unknown) {
  const error = cause as { code?: string; message?: string } | null
  if (error?.code === '23505') {
    return 'Ya existe un bovino con ese número DIIO o identificador interno.'
  }
  if (error?.message) return error.message
  return 'No se pudo guardar el bovino.'
}

function asBovines(data: unknown) {
  return (Array.isArray(data) ? data : []) as Bovine[]
}

// RF-UC04-01: consulta los toros de una finca con sus datos básicos y estado.
export async function loadBovines(farmId: string) {
  return cachedRead(`bovines:${farmId}`, farmId, () => fetchBovines(farmId))
}

// Obtiene los toros autorizados de la finca mediante la RPC de consulta.
async function fetchBovines(farmId: string) {
  const { data, error } = await supabase
    .rpc('obtener_bovinos_finca', { p_finca_id: farmId })
    .abortSignal(AbortSignal.timeout(8000))

  if (error) throw error
  return asBovines(data)
}

// RF-UC04-01: crea un toro reutilizando la operación de alta múltiple.
export async function createBovine(payload: CreateBovineInput) {
  const created = await createBovines([payload])
  if (!created[0]) throw new Error('No se pudo guardar el bovino.')
  return created[0]
}

// RF-UC04-01 y RF-UC03-02: da de alta toros; el trigger SQL conserva la asignación inicial.
export async function createBovines(payloads: CreateBovineInput[]) {
  requireConnection()
  const { data, error } = await supabase.rpc('registrar_bovinos', { p_bovinos: payloads })
  if (error) throw error
  const created = asBovines(data)
  if (!created.length) throw new Error('No se pudo guardar el bovino.')
  return created
}

// RF-UC04-01: actualiza datos básicos; movimientos, venta y baja usan sus propias RPC.
export async function updateBovine(id: string, patch: UpdateBovineInput) {
  requireConnection()
  const { data, error } = await supabase.rpc('actualizar_bovino', {
    p_id: id,
    p_identificador_interno: patch.identificador_interno,
    p_nombre: patch.nombre,
    p_raza: patch.raza,
    p_color: patch.color,
  })
  if (error) throw error
  if (!data) throw new Error('No se pudo guardar el bovino.')
  return data as Bovine
}

// Construye la identificación visible del toro a partir de nombre, interno y DIIO.
export function bovineLabel(bovine: Pick<Bovine, 'nombre' | 'numero_diio' | 'identificador_interno'>) {
  if (bovine.nombre) return `${bovine.nombre} · ${bovine.identificador_interno}`
  if (bovine.numero_diio) {
    return `${bovine.identificador_interno} · DIIO ${bovine.numero_diio}`
  }
  return bovine.identificador_interno
}

const statusLabels: Record<Bovine['estado'], string> = {
  ACTIVO: 'Activo', INACTIVO: 'Inactivo', VENDIDO: 'Vendido', BAJA: 'Baja',
}

// Traduce el estado del toro usando las mismas etiquetas en ficha, listas y PDF.
export function bovineStatusLabel(estado: Bovine['estado']) {
  return statusLabels[estado]
}
