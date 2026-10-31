import { supabase } from './supabase.ts'
import { cachedRead, capture, requireConnection } from '../offline/runtime.ts'
import { isValidIsoDate } from './dates.ts'
import {
  INVENTORY_CATEGORIES,
  MOVEMENT_TYPES,
  type InventoryItem,
  type InventoryMovement,
  type InventoryReport,
  type InventorySummary,
  type InventoryCategory,
  type MovementType,
  type MovementPage,
} from '../types/inventory.ts'

// Construye el error común para una respuesta de inventario que no respeta el contrato.
const invalid = () => new Error('El servidor devolvió datos de inventario inválidos. Actualiza e intenta consultar de nuevo.')
// Exige un objeto JSON antes de adaptar sus propiedades.
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
// Exige una lista JSON antes de transformar sus elementos.
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw invalid()
  return value
}
// Exige un texto no vacío para los campos obligatorios del contrato.
function str(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw invalid()
  return value
}
// Adapta los textos opcionales manteniendo explícitos los valores null.
function nullableStr(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw invalid()
  return value
}
// Convierte números del JSON y rechaza formatos inesperados o valores no finitos.
function num(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value))) throw invalid()
  const n = Number(value)
  if (!Number.isFinite(n)) throw invalid()
  return n
}
// Exige un booleano para evitar interpretar estados ambiguos de la respuesta.
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw invalid()
  return value
}
// Comprueba que la categoría pertenezca a los tipos de insumo permitidos.
function category(value: unknown): InventoryCategory {
  if (!INVENTORY_CATEGORIES.includes(value as InventoryCategory)) throw invalid()
  return value as InventoryCategory
}
// Comprueba que el tipo de movimiento pertenezca al catálogo permitido.
function movementType(value: unknown): MovementType {
  if (!MOVEMENT_TYPES.includes(value as MovementType)) throw invalid()
  return value as MovementType
}
// Verifica formato y fecha de calendario sin aceptar días inexistentes.
export function validInventoryDate(value: string): boolean {
  return isValidIsoDate(value)
}
// Adapta una fecha del contrato y rechaza valores inválidos.
function date(value: unknown): string {
  const s = str(value)
  if (!validInventoryDate(s)) throw invalid()
  return s
}
// Valida ambas fechas del periodo y que Desde no sea posterior a Hasta.
export function validateInventoryPeriod(desde: string, hasta: string) {
  if (!validInventoryDate(desde) || !validInventoryDate(hasta) || desde > hasta) {
    throw new Error('Selecciona fechas válidas con Desde menor o igual a Hasta.')
  }
}
// Valida cantidad positiva, límite numérico y máximo dos decimales antes de enviar.
export function parseInventoryQuantity(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Usa una cantidad positiva con máximo dos decimales.')
  const cantidad = Number(value)
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 99999999.99) {
    throw new Error('La cantidad debe ser mayor que cero y no superar 99.999.999,99.')
  }
  return cantidad
}
// Traduce errores de acceso, validación y red del inventario para la interfaz.
export function inventoryErrorMessage(cause: unknown): string {
  const error = cause as { code?: string; message?: string } | null
  if (error?.message?.includes('INVENTARIO_')) return error.message.replace(/^.*?INVENTARIO_[A-Z_]+:\s*/, '')
  if (error?.code === '23505' && error.message?.includes('insumo_finca_nombre_unico_idx')) {
    return 'Ya existe un insumo con ese nombre en esta finca, incluso entre los inactivos. Revisa el catálogo; para agregar existencias usa una entrada del insumo existente.'
  }
  if (error?.code === '42501') return 'No tienes permiso para esta operación en la finca seleccionada.'
  if (error?.code === 'PGRST202') return 'Las funciones de inventario todavía no están disponibles en Supabase.'
  if (error?.message && /fetch|network|offline|conexión/i.test(error.message)) {
    return 'No se pudo conectar al servidor. Tus capturas pendientes se conservan en el dispositivo.'
  }
  return error?.message ?? 'No se pudo consultar o guardar el inventario. Intenta nuevamente.'
}
// Ejecuta una RPC de inventario y traduce el error antes de adaptar la respuesta.
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(inventoryErrorMessage(error), { cause: error })
  return data
}
// Adapta un insumo del JSON manteniendo estado, categoría y saldo tipados.
function item(value: unknown): InventoryItem {
  const r = object(value)
  return { id: str(r.id), finca_id: str(r.finca_id), nombre: str(r.nombre), tipo: category(r.tipo),
    unidad_medida: str(r.unidad_medida), activo: bool(r.activo), stock: num(r.stock) }
}
// Adapta un movimiento del JSON con cantidad, fechas y responsable tipados.
function movement(value: unknown): InventoryMovement {
  const r = object(value)
  const cantidad = num(r.cantidad)
  if (cantidad <= 0) throw invalid()
  return { id: str(r.id), insumo_id: str(r.insumo_id), tipo: movementType(r.tipo), cantidad,
    fecha_movimiento: date(r.fecha_movimiento), registrado_por: nullableStr(r.registrado_por),
    responsable_nombre: nullableStr(r.responsable_nombre), observaciones: nullableStr(r.observaciones),
    created_at: nullableStr(r.created_at) }
}
// RF-UC08-01 y RF-UC09-02: consulta catálogo y saldos de la finca autorizada.
export async function loadInventory(farmId: string): Promise<InventoryItem[]> {
  return cachedRead(`inventory:${farmId}`, farmId, () => fetchInventory(farmId))
}

// Consulta y valida catálogo y saldos antes de conservar su copia operativa.
async function fetchInventory(farmId: string): Promise<InventoryItem[]> {
  const rows = list(await rpc('obtener_inventario_finca', { p_finca_id: farmId })).map(item)
  if (rows.some((r) => r.finca_id !== farmId)) throw invalid()
  return rows
}
// RF-UC09-02: consulta una página del historial y su total sin mezclar insumos.
export async function loadInventoryMovements(itemId: string, offset = 0, farmId: string): Promise<MovementPage> {
  return cachedRead(`history:${itemId}:${offset}`, farmId, () => fetchInventoryMovements(itemId, offset))
}

// Consulta una página confirmada del historial del insumo.
async function fetchInventoryMovements(itemId: string, offset: number): Promise<MovementPage> {
  const r = object(await rpc('obtener_movimientos_insumo', { p_insumo_id: itemId, p_limite: 50, p_offset: offset }))
  const movimientos = list(r.movimientos).map(movement)
  const total = num(r.total)
  if (!Number.isSafeInteger(total) || total < movimientos.length || movimientos.some((m) => m.insumo_id !== itemId)) throw invalid()
  return { movimientos, total }
}
// RF-UC08-01: valida el formulario y solicita crear o editar un insumo.
export async function saveInventoryItem(farmId: string, input: {
  nombre: string; tipo: InventoryCategory; unidad_medida: string; id?: string
}): Promise<InventoryItem> {
  requireConnection()
  const nombre = input.nombre.trim(), unidad = input.unidad_medida.trim()
  if (!nombre || nombre.length > 100 || !unidad || unidad.length > 20) throw new Error('Completa nombre y unidad válidos.')
  const result = item(await rpc('guardar_insumo', { p_finca_id: farmId, p_nombre: nombre, p_tipo: input.tipo,
    p_unidad_medida: unidad, p_insumo_id: input.id ?? null }))
  if (result.finca_id !== farmId || (input.id && result.id !== input.id)) throw invalid()
  return result
}
// RF-UC08-01: solicita desactivar el insumo conservando su historial.
export async function deactivateInventoryItem(itemId: string): Promise<InventoryItem> {
  requireConnection()
  const result = item(await rpc('desactivar_insumo', { p_insumo_id: itemId }))
  if (result.id !== itemId || result.activo) throw invalid()
  return result
}
// RF-UC09-01: valida la captura y obtiene movimiento y saldo confirmados por la RPC.
export async function registerInventoryMovement(itemId: string, input: {
  tipo: MovementType; cantidad: string; fecha: string; observaciones: string
}, farmId: string, currentStock: number) {
  const cantidad = parseInventoryQuantity(input.cantidad)
  if (!validInventoryDate(input.fecha)) throw new Error('Selecciona una fecha válida para el movimiento.')
  if (!MOVEMENT_TYPES.includes(input.tipo)) throw new Error('Selecciona un tipo de movimiento válido.')
  if (!Number.isFinite(currentStock) || currentStock < 0) throw new Error('Actualiza las existencias antes de registrar el movimiento.')
  const delta = ['ENTRADA', 'AJUSTE_POSITIVO'].includes(input.tipo) ? cantidad : -cantidad
  const stock = (Math.round(currentStock * 100) + Math.round(delta * 100)) / 100
  if (stock < 0) throw new Error('Saldo insuficiente para registrar este movimiento.')
  return capture(farmId, 'inventory', { insumo_id: itemId, tipo: input.tipo,
    cantidad, fecha: input.fecha, observaciones: input.observaciones }, (id) => ({
    stock, movimiento: { id, insumo_id: itemId, tipo: input.tipo, cantidad,
      fecha_movimiento: input.fecha, registrado_por: null, responsable_nombre: 'Pendiente de confirmar',
      observaciones: input.observaciones, created_at: new Date().toISOString() } satisfies InventoryMovement,
  }))
}
// Adapta y valida el reporte, incluyendo periodo, números y coherencia de saldos.
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
// RF-TR-03: consulta el resumen y detalle de bodega para la finca y periodo indicados.
export async function loadInventoryReport(farmId: string, desde: string, hasta: string): Promise<InventoryReport> {
  requireConnection()
  validateInventoryPeriod(desde, hasta)
  const report = parseInventoryReport(await rpc('obtener_reporte_inventario', {
    p_finca_id: farmId, p_desde: desde, p_hasta: hasta,
  }))
  if (report.finca_id !== farmId || report.desde !== desde || report.hasta !== hasta) throw invalid()
  return report
}
