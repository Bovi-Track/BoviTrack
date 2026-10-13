import { supabase } from './supabase.ts'
import {
  INVENTORY_CATEGORIES, MOVEMENT_TYPES,
  type InventoryItem, type InventoryMovement, type InventoryReport, type InventorySummary,
  type InventoryCategory, type MovementType, type MovementPage,
} from '../types/inventory.ts'

const invalid = () => new Error('El servidor devolvió datos de inventario inválidos. Actualiza e intenta consultar de nuevo.')
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw invalid()
  return value
}
function str(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw invalid()
  return value
}
function nullableStr(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw invalid()
  return value
}
function num(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value))) throw invalid()
  const n = Number(value)
  if (!Number.isFinite(n)) throw invalid()
  return n
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw invalid()
  return value
}
function category(value: unknown): InventoryCategory {
  if (!INVENTORY_CATEGORIES.includes(value as InventoryCategory)) throw invalid()
  return value as InventoryCategory
}
function movementType(value: unknown): MovementType {
  if (!MOVEMENT_TYPES.includes(value as MovementType)) throw invalid()
  return value as MovementType
}
export function validInventoryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(y, m - 1, d)
  return y > 0 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}
function date(value: unknown): string {
  const s = str(value)
  if (!validInventoryDate(s)) throw invalid()
  return s
}
export function validateInventoryPeriod(desde: string, hasta: string) {
  if (!validInventoryDate(desde) || !validInventoryDate(hasta) || desde > hasta) {
    throw new Error('Selecciona fechas válidas con Desde menor o igual a Hasta.')
  }
}
export function parseInventoryQuantity(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Usa una cantidad positiva con máximo dos decimales.')
  const cantidad = Number(value)
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 99999999.99) {
    throw new Error('La cantidad debe ser mayor que cero y no superar 99.999.999,99.')
  }
  return cantidad
}
export function inventoryErrorMessage(cause: unknown): string {
  const error = cause as { code?: string; message?: string } | null
  if (error?.message?.includes('INVENTARIO_')) return error.message.replace(/^.*?INVENTARIO_[A-Z_]+:\s*/, '')
  if (error?.code === '42501') return 'No tienes permiso para esta operación en la finca seleccionada.'
  if (error?.code === 'PGRST202') return 'Las funciones de inventario todavía no están disponibles en Supabase.'
  if (error?.message && /fetch|network|offline|conexión/i.test(error.message)) {
    return 'No se pudo confirmar la operación por un fallo de conexión. Actualiza el historial antes de repetir un movimiento.'
  }
  return error?.message ?? 'No se pudo consultar o guardar el inventario. Intenta nuevamente.'
}
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(inventoryErrorMessage(error))
  return data
}
function item(value: unknown): InventoryItem {
  const r = object(value)
  return { id: str(r.id), finca_id: str(r.finca_id), nombre: str(r.nombre), tipo: category(r.tipo),
    unidad_medida: str(r.unidad_medida), activo: bool(r.activo), stock: num(r.stock) }
}
function movement(value: unknown): InventoryMovement {
  const r = object(value)
  const cantidad = num(r.cantidad)
  if (cantidad <= 0) throw invalid()
  return { id: str(r.id), insumo_id: str(r.insumo_id), tipo: movementType(r.tipo), cantidad,
    fecha_movimiento: date(r.fecha_movimiento), registrado_por: nullableStr(r.registrado_por),
    responsable_nombre: nullableStr(r.responsable_nombre), observaciones: nullableStr(r.observaciones),
    created_at: nullableStr(r.created_at) }
}
export async function loadInventory(farmId: string): Promise<InventoryItem[]> {
  const rows = list(await rpc('obtener_inventario_finca', { p_finca_id: farmId })).map(item)
  if (rows.some((r) => r.finca_id !== farmId)) throw invalid()
  return rows
}
export async function loadInventoryMovements(itemId: string, offset = 0): Promise<MovementPage> {
  const r = object(await rpc('obtener_movimientos_insumo', { p_insumo_id: itemId, p_limite: 50, p_offset: offset }))
  const movimientos = list(r.movimientos).map(movement)
  const total = num(r.total)
  if (!Number.isSafeInteger(total) || total < movimientos.length || movimientos.some((m) => m.insumo_id !== itemId)) throw invalid()
  return { movimientos, total }
}
export async function saveInventoryItem(farmId: string, input: {
  nombre: string; tipo: InventoryCategory; unidad_medida: string; id?: string
}): Promise<InventoryItem> {
  const nombre = input.nombre.trim(), unidad = input.unidad_medida.trim()
  if (!nombre || nombre.length > 100 || !unidad || unidad.length > 20) throw new Error('Completa nombre y unidad válidos.')
  const result = item(await rpc('guardar_insumo', { p_finca_id: farmId, p_nombre: nombre, p_tipo: input.tipo,
    p_unidad_medida: unidad, p_insumo_id: input.id ?? null }))
  if (result.finca_id !== farmId || (input.id && result.id !== input.id)) throw invalid()
  return result
}
export async function deactivateInventoryItem(itemId: string): Promise<InventoryItem> {
  const result = item(await rpc('desactivar_insumo', { p_insumo_id: itemId }))
  if (result.id !== itemId || result.activo) throw invalid()
  return result
}
export async function registerInventoryMovement(itemId: string, input: {
  tipo: MovementType; cantidad: string; fecha: string; observaciones: string
}): Promise<{ movimiento: InventoryMovement; stock: number }> {
  const cantidad = parseInventoryQuantity(input.cantidad)
  if (!validInventoryDate(input.fecha)) throw new Error('Selecciona una fecha válida para el movimiento.')
  const r = object(await rpc('registrar_movimiento_inventario', { p_insumo_id: itemId, p_tipo: input.tipo,
    p_cantidad: cantidad, p_fecha_movimiento: input.fecha, p_observaciones: input.observaciones.trim() || null }))
  const movimiento = movement(r.movimiento), stock = num(r.stock)
  if (movimiento.insumo_id !== itemId || stock < 0) throw invalid()
  return { movimiento, stock }
}
export function parseInventoryReport(value: unknown): InventoryReport {
  const r = object(value), desde = date(r.desde), hasta = date(r.hasta)
  validateInventoryPeriod(desde, hasta)
  const resumen = list(r.resumen).map((value): InventorySummary => {
    const s = object(value)
    return { insumo_id: str(s.insumo_id), nombre: str(s.nombre), tipo: category(s.tipo),
      unidad_medida: str(s.unidad_medida), activo: bool(s.activo), saldo_inicial: num(s.saldo_inicial),
      entradas: num(s.entradas), salidas: num(s.salidas), consumos: num(s.consumos),
      ajustes_positivos: num(s.ajustes_positivos), ajustes_negativos: num(s.ajustes_negativos), saldo_final: num(s.saldo_final) }
  })
  const movimientos = list(r.movimientos).map((value) => {
    const m = object(value)
    return { ...movement(m), insumo_nombre: str(m.insumo_nombre), unidad_medida: str(m.unidad_medida) }
  })
  const ids = new Set(resumen.map((s) => s.insumo_id))
  if (ids.size !== resumen.length || resumen.some((s) =>
    [s.entradas, s.salidas, s.consumos, s.ajustes_positivos, s.ajustes_negativos].some((n) => n < 0)
    || Math.abs(s.saldo_inicial + s.entradas - s.salidas - s.consumos + s.ajustes_positivos - s.ajustes_negativos - s.saldo_final) > 0.005)) throw invalid()
  if (movimientos.some((m) => !ids.has(m.insumo_id) || m.fecha_movimiento < desde || m.fecha_movimiento > hasta)) throw invalid()
  return { finca_id: str(r.finca_id), finca_nombre: str(r.finca_nombre), desde, hasta, resumen, movimientos }
}
export async function loadInventoryReport(farmId: string, desde: string, hasta: string): Promise<InventoryReport> {
  validateInventoryPeriod(desde, hasta)
  const report = parseInventoryReport(await rpc('obtener_reporte_inventario', {
    p_finca_id: farmId, p_desde: desde, p_hasta: hasta,
  }))
  if (report.finca_id !== farmId || report.desde !== desde || report.hasta !== hasta) throw invalid()
  return report
}
