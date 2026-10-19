import { requireConnection } from '../offline/runtime.ts'
import { supabase } from './supabase.ts'
import type { BovineTraceEvent, BovineTraceEventKind } from '../types/bovine-traceability.ts'

const eventKinds: BovineTraceEventKind[] = ['COMPRA', 'MOVIMIENTO', 'PESAJE', 'SANIDAD', 'VENTA', 'BAJA']

// RF-UC02-01: consulta todos los eventos operativos autorizados, sin devolver datos financieros.
export async function loadBovineTraceability(bovineId: string): Promise<BovineTraceEvent[]> {
  requireConnection()
  const { data, error } = await supabase.rpc('obtener_trazabilidad_bovino', { p_bovino_id: bovineId })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('El servidor devolvió una trazabilidad inválida.')
  return data.map((row: BovineTraceEvent) => {
    if (!row || typeof row.evento_id !== 'string' || !eventKinds.includes(row.tipo_evento) ||
        typeof row.fecha_evento !== 'string' || typeof row.titulo !== 'string' ||
        (row.detalle != null && typeof row.detalle !== 'string') || typeof row.responsable !== 'string') {
      throw new Error('El servidor devolvió un evento de trazabilidad inválido.')
    }
    return row
  })
}
