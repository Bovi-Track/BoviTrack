import { requireConnection } from '../offline/runtime.ts'
import { supabase } from './supabase.ts'
import type { BovineMovement, BovineMovementInput, BovineMovementKind, BovineMovementResult } from '../types/bovine-movements.ts'

export const bovineMovementLabels: Record<BovineMovementKind, string> = {
  ASIGNACION: 'Asignación', RETIRO: 'Retiro', TRASLADO: 'Traslado',
}

// RF-UC03-02: consulta movimientos autorizados; la finca conserva sus entradas y salidas.
export async function loadBovineMovements(farmId: string, bovineId: string | null, offset = 0): Promise<BovineMovement[]> {
  requireConnection()
  const { data, error } = await supabase.rpc('obtener_movimientos_bovinos', {
    p_finca_id: farmId, p_bovino_id: bovineId, p_limite: 51, p_desde: offset,
  })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('El servidor devolvió movimientos inválidos.')
  return data.map((row: BovineMovement) => {
    if (!row || typeof row.id !== 'string' || typeof row.bovino_id !== 'string' ||
        typeof row.fecha_movimiento !== 'string' || !Object.hasOwn(bovineMovementLabels, row.tipo)) {
      throw new Error('El servidor devolvió un movimiento inválido.')
    }
    return row
  })
}

// RF-UC03-02: registra retiro, reingreso o traslado con un ID estable para reintentar sin duplicar.
export async function registerBovineMovement(input: BovineMovementInput): Promise<BovineMovementResult> {
  requireConnection()
  const { data, error } = await supabase.rpc('registrar_movimiento_bovino', {
    p_bovino_id: input.bovineId, p_finca_origen_id: input.originId, p_tipo: input.kind,
    p_finca_destino_id: input.destinationId, p_fecha: input.date,
    p_observaciones: input.notes.trim() || null, p_operacion_id: input.operationId,
  })
  if (error) throw error
  if (!data || typeof data.id !== 'string' || data.bovino_id !== input.bovineId ||
      typeof data.finca_id !== 'string' || !['ACTIVO', 'INACTIVO'].includes(data.estado)) {
    throw new Error('El servidor no confirmó el movimiento.')
  }
  return data as BovineMovementResult
}
