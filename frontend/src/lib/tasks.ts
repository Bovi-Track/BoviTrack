import { supabase } from './supabase.ts'
import type { Task } from '../types/dashboard.ts'

// RF-UC11-01 y RF-UC11-02: consulta las tareas devueltas por la RPC de la finca.
export async function loadTasks(farmId: string) {
  const { data, error } = await supabase.rpc('obtener_tareas_finca', {
    p_finca_id: farmId,
  })

  if (error) throw error
  return (data ?? []) as Task[]
}

// RF-UC11-01 (parcial): solicita crear y asignar una tarea de campo.
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

// RF-UC11-02: solicita cambiar una tarea entre pendiente y completada.
export async function updateTaskDone(id: string, done: boolean) {
  const { error } = await supabase.rpc('marcar_tarea_estado', {
    p_id: id,
    p_estado: done ? 'COMPLETADA' : 'PENDIENTE',
  })
  if (error) throw error
}
