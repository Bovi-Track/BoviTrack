export const INVENTORY_CATEGORIES = ['ALIMENTO', 'SUPLEMENTO', 'MEDICAMENTO', 'VACUNA'] as const
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]
export const MOVEMENT_TYPES = ['ENTRADA', 'SALIDA', 'CONSUMO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] as const
export type MovementType = typeof MOVEMENT_TYPES[number]
export const movementLabels: Record<MovementType, string> = {
  ENTRADA: 'Entrada', SALIDA: 'Salida', CONSUMO: 'Consumo',
  AJUSTE_POSITIVO: 'Ajuste positivo', AJUSTE_NEGATIVO: 'Ajuste negativo',
}
export type InventoryItem = {
  id: string
  finca_id: string
  nombre: string
  tipo: InventoryCategory
  unidad_medida: string
  activo: boolean
  stock: number
}
export type InventoryMovement = {
  id: string
  insumo_id: string
  tipo: MovementType
  cantidad: number
  fecha_movimiento: string
  registrado_por: string | null
  responsable_nombre: string | null
  observaciones: string | null
  created_at: string | null
}
export type MovementPage = { movimientos: InventoryMovement[]; total: number }
export type InventorySummary = {
  insumo_id: string
  nombre: string
  tipo: InventoryCategory
  unidad_medida: string
  activo: boolean
  saldo_inicial: number
  entradas: number
  salidas: number
  consumos: number
  ajustes_positivos: number
  ajustes_negativos: number
  saldo_final: number
}
export type InventoryReport = {
  finca_id: string
  finca_nombre: string
  desde: string
  hasta: string
  resumen: InventorySummary[]
  movimientos: (InventoryMovement & { insumo_nombre: string; unidad_medida: string })[]
}
