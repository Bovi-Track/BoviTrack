import { requireConnection } from '../offline/runtime.ts'
import { daysBetween, isValidIsoDate } from './dates.ts'
import { supabase } from './supabase.ts'
import type {
  Bovine,
  BovineAcquisitionCost,
  SaleInput,
  SalePreview,
  SaleRecord,
  Weighing,
} from '../types/dashboard.ts'

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

// RF-UC12-01/02: consulta el historial de ventas únicamente como administrador de la finca.
export async function loadSales(farmId: string): Promise<SaleRecord[]> {
  requireConnection()
  const { data, error } = await supabase.rpc('obtener_ventas_finca', { p_finca_id: farmId })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('El servidor devolvió ventas inválidas.')
  return data.map(parseSaleRecord)
}

// RF-UC12-01/02: delega registro, cálculo financiero y cambio de estado a una transacción SQL.
export async function registerSale(input: SaleInput): Promise<SaleRecord> {
  requireConnection()
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_bovino_id: input.bovinoId,
    p_fecha_venta: input.fechaVenta,
    p_peso_salida_kg: input.pesoSalidaKg,
    p_precio_kilo: input.precioKilo,
    p_comprador_canal: input.compradorCanal,
    p_mantenimiento_diario: input.mantenimientoDiario,
  })
  if (error) throw error
  return parseSaleRecord(data)
}

// Calcula la vista previa con la misma regla que aplica la transacción de venta.
export function calculateSalePreview(
  bovine: Bovine,
  acquisition: BovineAcquisitionCost | undefined,
  weighings: Weighing[],
  fechaVenta: string,
  pesoSalidaKg: number,
  precioKilo: number,
  mantenimientoDiario: number,
): SalePreview | null {
  if (!bovine.fecha_ingreso || !isValidIsoDate(bovine.fecha_ingreso) ||
      !isValidIsoDate(fechaVenta) || fechaVenta < bovine.fecha_ingreso ||
      !Number.isFinite(pesoSalidaKg) || pesoSalidaKg <= 0 ||
      !Number.isFinite(precioKilo) || precioKilo <= 0 ||
      !Number.isFinite(mantenimientoDiario) || mantenimientoDiario < 0) return null
  const initial = weighings.find((item) => item.bovino_id === bovine.id && item.es_inicial)
  const hasAcquisition = Boolean(acquisition?.compra_id && acquisition.precio_compra_kilo != null &&
    acquisition.precio_compra_kilo > 0 && initial && Number.isFinite(initial.peso_kg) &&
    initial.peso_kg > 0 && Number.isFinite(acquisition.costo_flete_asignado) &&
    acquisition.costo_flete_asignado >= 0)
  const costoCompra = hasAcquisition && acquisition && initial
    ? roundMoney(initial.peso_kg * acquisition.precio_compra_kilo! + acquisition.costo_flete_asignado)
    : null
  const diasMantenimiento = daysBetween(bovine.fecha_ingreso, fechaVenta)
  const mantenimientoAcumulado = roundMoney(mantenimientoDiario * diasMantenimiento)
  const ingresoBruto = roundMoney(pesoSalidaKg * precioKilo)
  return {
    diasMantenimiento,
    ingresoBruto,
    costoCompra,
    mantenimientoAcumulado,
    rentabilidad: costoCompra == null ? null : roundMoney(ingresoBruto - costoCompra - mantenimientoAcumulado),
  }
}

function parseSaleRecord(row: unknown): SaleRecord {
  if (!row || typeof row !== 'object') throw new Error('El servidor devolvió una venta inválida.')
  const item = row as Record<string, unknown>
  const numeric = (value: unknown, nullable = false) => {
    if (nullable && value == null) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const weight = numeric(item.peso_salida_kg)
  const price = numeric(item.precio_kilo)
  const profit = numeric(item.rentabilidad_calculada, true)
  const acquisition = numeric(item.costo_compra_calculado, true)
  const maintenance = numeric(item.mantenimiento_acumulado, true)
  if (typeof item.id !== 'string' || typeof item.bovino_id !== 'string' ||
      typeof item.identificador_interno !== 'string' ||
      (item.nombre != null && typeof item.nombre !== 'string') ||
      typeof item.fecha_venta !== 'string' || weight == null || weight <= 0 ||
      price == null || price <= 0 || typeof item.comprador_canal !== 'string' ||
      profit === null && item.rentabilidad_calculada != null ||
      acquisition === null && item.costo_compra_calculado != null ||
      maintenance === null && item.mantenimiento_acumulado != null) {
    throw new Error('El servidor devolvió una venta inválida.')
  }
  return {
    id: item.id,
    bovino_id: item.bovino_id,
    identificador_interno: item.identificador_interno,
    nombre: typeof item.nombre === 'string' ? item.nombre : null,
    fecha_venta: item.fecha_venta,
    peso_salida_kg: weight,
    precio_kilo: price,
    comprador_canal: item.comprador_canal,
    rentabilidad_calculada: profit,
    costo_compra_calculado: acquisition,
    mantenimiento_acumulado: maintenance,
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
