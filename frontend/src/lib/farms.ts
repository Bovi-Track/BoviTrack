import { supabase } from './supabase.ts'
import type { Farm, FarmMember, FarmRole } from '../types/dashboard.ts'

const ACTIVE_FARM_KEY = 'bovitrack-active-farm'

// Traduce un rol conocido a su etiqueta; mantiene explícito el rol desconocido.
export function roleLabel(role: FarmRole) {
  if (role === 'unknown') return 'Rol no reconocido'
  return role === 'admin' ? 'Administrador de Finca' : 'Personal de Campo'
}

// Normaliza solo los nombres de rol reconocidos; cualquier otro queda como unknown.
export function mapRole(name: string | null | undefined): FarmRole {
  const normalized = name?.trim().toUpperCase()
  if (normalized === 'ADMINISTRADOR' || normalized === 'ADMINISTRADOR DE FINCA') return 'admin'
  if (normalized === 'PERSONAL_CAMPO' || normalized === 'PERSONAL DE CAMPO') return 'campo'
  return 'unknown'
}

// Lee la última finca seleccionada en este navegador.
export function getStoredFarmId() {
  return localStorage.getItem(ACTIVE_FARM_KEY)
}

// Guarda o retira la preferencia de finca seleccionada.
export function storeFarmId(id: string | null) {
  if (!id) {
    localStorage.removeItem(ACTIVE_FARM_KEY)
    return
  }
  localStorage.setItem(ACTIVE_FARM_KEY, id)
}

// RF-UC03-01 y RF-UC14-03: consulta las fincas y roles devueltos para el usuario.
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

// RF-UC03-01: solicita la creación de una finca mediante la RPC existente.
export async function createFarm(nombre: string, ubicacion: string) {
  const { data, error } = await supabase.rpc('crear_finca', {
    p_nombre: nombre,
    p_ubicacion: ubicacion,
  })
  if (error) throw error
  return data as Farm
}

// RF-UC03-01: solicita actualizar nombre, ubicación y estado de una finca.
export async function updateFarm(
  farmId: string,
  patch: Partial<Pick<Farm, 'nombre' | 'ubicacion' | 'activo'>>,
) {
  const { data, error } = await supabase.rpc('actualizar_finca', {
    p_finca_id:  farmId,
    p_nombre:    patch.nombre    ?? '',
    p_ubicacion: patch.ubicacion ?? null,
    p_activo:    patch.activo    ?? true,
  })
  if (error) throw error
  return data as Farm
}

// RF-UC15-02: consulta los roles disponibles para asociar personal a la finca.
export async function loadRoles(): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await supabase.rpc('obtener_roles')
  if (error) throw error
  return (data ?? []) as { id: string; nombre: string }[]
}

// RF-UC15-01 (parcial): consulta los miembros asociados a una finca.
export async function loadFarmMembers(farmId: string): Promise<FarmMember[]> {
  const { data, error } = await supabase.rpc('obtener_miembros_finca', {
    p_finca_id: farmId,
  })
  if (error) throw error

  return ((data ?? []) as {
    usuario_id: string
    correo: string
    nombre_completo: string | null
    rol_id: string
    rol_nombre: string
  }[]).map((row) => ({
    userId: row.usuario_id,
    email: row.correo,
    nombre: row.nombre_completo,
    role: mapRole(row.rol_nombre),
    roleId: row.rol_id,
    roleName: row.rol_nombre,
  }))
}

// RF-UC15-01 y RF-UC15-02 (parcial): asocia una cuenta existente con finca y rol.
export async function addFarmMember(
  farmId: string,
  email: string,
  roleId: string,
): Promise<void> {
  const { error } = await supabase.rpc('agregar_miembro_finca', {
    p_finca_id: farmId,
    p_correo:   email,
    p_rol_id:   roleId,
  })
  if (error) throw error
}

// RF-UC15-01 (parcial): retira la asociación a la finca; no desactiva la cuenta.
export async function removeFarmMember(farmId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('eliminar_miembro_finca', {
    p_finca_id:   farmId,
    p_usuario_id: userId,
  })
  if (error) throw error
}

// RF-UC15-01 y RF-UC15-02 (parcial): genera una invitación con finca y rol.
export async function createFarmInvitation(
  farmId: string,
  roleId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('crear_invitacion_finca', {
    p_finca_id: farmId,
    p_rol_id:   roleId,
  })
  if (error) throw error
  return data as string
}

// RF-UC15-02: solicita aceptar una invitación de finca con la sesión autenticada.
export async function acceptFarmInvitation(
  token: string,
): Promise<{ finca_id: string; nombre: string; ubicacion: string | null; activo: boolean }> {
  const { data, error } = await supabase.rpc('aceptar_invitacion_finca', {
    p_token: token,
  })
  if (error) throw error
  return data as { finca_id: string; nombre: string; ubicacion: string | null; activo: boolean }
}
