import { supabase } from './supabase.ts'
import type { Bovine, CreateBovineInput, UpdateBovineInput } from '../types/dashboard.ts'

const BOVINE_COLUMNS =
  'id, finca_id, numero_diio, identificador_interno, nombre, raza, color, sexo, estado'

// Traduce errores de unicidad o guardado del toro a mensajes de interfaz.
export function bovineErrorMessage(cause: unknown) {
  const error = cause as { code?: string; message?: string } | null
  if (error?.code === '23505') {
    return 'Ya existe un bovino con ese número DIIO o identificador interno.'
  }
  if (error?.message) return error.message
  return 'No se pudo guardar el bovino.'
}

// RF-UC04-01: consulta los toros de una finca con sus datos básicos y estado.
export async function loadBovines(farmId: string) {
  const { data, error } = await supabase
    .from('bovino')
    .select(BOVINE_COLUMNS)
    .eq('finca_id', farmId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Bovine[]
}

// RF-UC04-01: crea un toro reutilizando la operación de alta múltiple.
export async function createBovine(payload: CreateBovineInput) {
  const created = await createBovines([payload])
  if (!created[0]) throw new Error('No se pudo guardar el bovino.')
  return created[0]
}

// RF-UC04-01 y RF-UC03-02 (parcial): da de alta toros vinculados a su finca inicial.
// El retiro, traslado y su historial todavía requieren sus propios flujos.
export async function createBovines(payloads: CreateBovineInput[]) {
  const { data, error } = await supabase
    .from('bovino')
    .insert(payloads)
    .select(BOVINE_COLUMNS)

  if (error) throw error
  return (data ?? []) as Bovine[]
}

// RF-UC04-01 (parcial): actualiza la ficha; las transiciones de venta/baja siguen pendientes.
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

// Construye la identificación visible del toro a partir de nombre, interno y DIIO.
export function bovineLabel(bovine: Pick<Bovine, 'nombre' | 'numero_diio' | 'identificador_interno'>) {
  if (bovine.nombre) return `${bovine.nombre} · ${bovine.identificador_interno}`
  if (bovine.numero_diio) {
    return `${bovine.identificador_interno} · DIIO ${bovine.numero_diio}`
  }
  return bovine.identificador_interno
}

const statusLabels: Record<Bovine['estado'], string> = {
  ACTIVO: 'Activo', INACTIVO: 'Inactivo', VENDIDO: 'Vendido', BAJA: 'Baja', MUERTO: 'Muerto',
}

// Traduce el estado del toro usando las mismas etiquetas en ficha, listas y PDF.
export function bovineStatusLabel(estado: Bovine['estado']) {
  return statusLabels[estado]
}
