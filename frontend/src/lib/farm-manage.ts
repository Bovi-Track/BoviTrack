import { supabase } from './supabase.ts'
import { mapRole } from './dashboard.ts'
import type { Farm, FarmMember } from '../types/dashboard.ts'

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

export async function loadRoles(): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, nombre')
  if (error) throw error
  return (data ?? []) as { id: string; nombre: string }[]
}

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
  }))
}

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

export async function removeFarmMember(farmId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('eliminar_miembro_finca', {
    p_finca_id:   farmId,
    p_usuario_id: userId,
  })
  if (error) throw error
}
