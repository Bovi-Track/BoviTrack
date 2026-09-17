import { supabase } from './supabase.ts'
import type { CreatePurchaseInput, PurchaseResult } from '../types/purchases.ts'

export async function createPurchase(payload: CreatePurchaseInput) {
  const { data, error } = await supabase.rpc('registrar_compra_subasta', {
    p_id_subasta: payload.id_subasta,
    p_numero_factura: payload.numero_factura,
    p_fecha_compra: payload.fecha_compra,
    p_costo_flete_total: payload.costo_flete_total,
    p_proveedor: payload.proveedor,
    p_bovinos: payload.bovinos,
  })

  if (error) throw error
  return data as PurchaseResult
}

export function purchaseErrorMessage(cause: unknown) {
  const error = cause as { code?: string; message?: string } | null
  if (error?.code === '23505') {
    return 'Ya existe un bovino con ese número DIIO o identificador interno.'
  }
  if (error?.code === 'P0001' && error.message) return error.message
  if (error?.code === '42501' && error.message?.startsWith('No puede registrar')) {
    return error.message
  }
  if (error?.code === '42501' && error.message?.startsWith('La cuenta')) {
    return error.message
  }
  return 'No se pudo registrar la compra. Revisa los datos e inténtalo de nuevo.'
}

export function calculatePurchasePreview(
  bovines: { peso_compra_kg: number; precio_compra_kilo: number }[],
  freight: number,
) {
  const weightTotal = bovines.reduce(
    (sum, bovine) => sum + (Number.isFinite(bovine.peso_compra_kg) ? bovine.peso_compra_kg : 0),
    0,
  )
  const freightTotal = Number.isFinite(freight) && freight > 0 ? freight : 0
  let weightSoFar = 0
  let subtotal = 0

  const lines = bovines.map((bovine) => {
    const weight = Number.isFinite(bovine.peso_compra_kg) ? bovine.peso_compra_kg : 0
    const price = Number.isFinite(bovine.precio_compra_kilo) ? bovine.precio_compra_kilo : 0
    const baseCost = Math.round(weight * price * 100) / 100
    const freightShare = weightTotal > 0
      ? Math.round((freightTotal * (weightSoFar + weight) / weightTotal) * 100) / 100
        - Math.round((freightTotal * weightSoFar / weightTotal) * 100) / 100
      : 0
    weightSoFar += weight
    subtotal += baseCost
    return { baseCost, freightShare, initialCost: baseCost + freightShare }
  })

  return {
    lines,
    weightTotal,
    subtotal,
    freightTotal,
    initialTotal: subtotal + freightTotal,
  }
}
