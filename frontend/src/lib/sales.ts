import { requireConnection } from '../offline/runtime.ts'
import { supabase } from './supabase.ts'
import type { BovineAcquisitionCost } from '../types/dashboard.ts'

// RF-UC10-02: consulta costos de compra solo mediante la RPC financiera administrativa.
export async function loadBovineAcquisitionCosts(farmId: string): Promise<BovineAcquisitionCost[]> {
  requireConnection()
  const { data, error } = await supabase.rpc('obtener_costos_bovinos_finca', {
    p_finca_id: farmId,
  })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('El servidor devolvió costos de compra inválidos.')

  return data.map((row: Record<string, unknown>) => {
    const price = row.precio_compra_kilo == null ? null : Number(row.precio_compra_kilo)
    const freight = Number(row.costo_flete_asignado)
    if (typeof row.id !== 'string' ||
        (row.compra_id != null && typeof row.compra_id !== 'string') ||
        (price != null && (!Number.isFinite(price) || price <= 0)) ||
        !Number.isFinite(freight) || freight < 0) {
      throw new Error('El servidor devolvió costos de compra inválidos.')
    }
    return {
      id: row.id,
      compra_id: typeof row.compra_id === 'string' ? row.compra_id : null,
      precio_compra_kilo: price,
      costo_flete_asignado: freight,
    }
  })
}
