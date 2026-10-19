import { requireConnection } from '../offline/runtime.ts'
import { supabase } from './supabase.ts'
import type { CreatePurchaseInput, PurchaseResult } from '../types/purchases.ts'

// RF-UC01-01 y RF-UC01-02: envía la compra completa a su RPC transaccional.
export async function createPurchase(payload: CreatePurchaseInput) {
  requireConnection()
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

// Traduce errores de compra y unicidad de identificadores para el formulario.
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

// RF-UC01-02: estima costos y transporte proporcional; la RPC confirma el cálculo final.
export function calculatePurchasePreview(
  bovines: { peso_compra_kg: number; precio_compra_kilo: number }[],
  freight: number,
) {
  const toCents = (value: number) => {
    if (!Number.isFinite(value)) return 0n
    const negative = value < 0
    const [whole = '0', fraction = '00'] = Math.abs(value).toFixed(2).split('.')
    const cents = BigInt(whole) * 100n + BigInt(fraction)
    return negative ? -cents : cents
  }
  const fromCents = (value: bigint) => Number(value) / 100
  const roundRatio = (numerator: bigint, denominator: bigint) => {
    if (denominator <= 0n) return 0n
    const negative = numerator < 0n
    const absolute = negative ? -numerator : numerator
    const rounded = (absolute * 2n + denominator) / (denominator * 2n)
    return negative ? -rounded : rounded
  }

  const weights = bovines.map((bovine) => toCents(bovine.peso_compra_kg))
  const prices = bovines.map((bovine) => toCents(bovine.precio_compra_kilo))
  const weightTotalCents = weights.reduce((sum, weight) => sum + weight, 0n)
  const freightTotalCents = Number.isFinite(freight) && freight > 0 ? toCents(freight) : 0n
  let weightSoFarCents = 0n
  let subtotalCents = 0n

  const lines = bovines.map((_, index) => {
    const weightCents = weights[index]
    const baseCostCents = roundRatio(weightCents * prices[index], 100n)
    const freightShareCents = weightTotalCents > 0n
      ? roundRatio(freightTotalCents * (weightSoFarCents + weightCents), weightTotalCents)
        - roundRatio(freightTotalCents * weightSoFarCents, weightTotalCents)
      : 0n
    weightSoFarCents += weightCents
    subtotalCents += baseCostCents
    return {
      baseCost: fromCents(baseCostCents),
      freightShare: fromCents(freightShareCents),
      initialCost: fromCents(baseCostCents + freightShareCents),
    }
  })

  return {
    lines,
    weightTotal: fromCents(weightTotalCents),
    subtotal: fromCents(subtotalCents),
    freightTotal: fromCents(freightTotalCents),
    initialTotal: fromCents(subtotalCents + freightTotalCents),
  }
}
