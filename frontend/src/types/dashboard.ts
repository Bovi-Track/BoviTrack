export type Farm = {
  id: string
  nombre: string
  ubicacion: string | null
  activo: boolean
}

export type FarmRole = 'admin' | 'campo' | 'unknown'

export type FarmMember = {
  userId: string
  email: string
  nombre: string | null
  role: FarmRole
  roleId: string
  roleName?: string
}

export type Bovine = {
  id: string
  finca_id: string
  fecha_ingreso?: string
  numero_diio: string | null
  identificador_interno: string
  nombre: string | null
  raza: string | null
  color: string | null
  sexo: 'MACHO' | 'HEMBRA'
  estado: 'ACTIVO' | 'INACTIVO' | 'VENDIDO' | 'BAJA'
}

export type BovineStatus = Bovine['estado']

export type CreateBovineInput = {
  finca_id: string
  numero_diio: string | null
  identificador_interno: string
  nombre: string | null
  raza: string | null
  color: string | null
  sexo: 'MACHO' | 'HEMBRA'
  fecha_nacimiento: string | null
  fecha_ingreso: string
}

export type UpdateBovineInput = {
  identificador_interno: string
  nombre: string | null
  raza: string | null
  color: string | null
}

export type Task = {
  id: string
  titulo: string
  descripcion: string
  estado: 'PENDIENTE' | 'COMPLETADA'
  fecha_limite: string
  asignada_a: string | null
  asignada_nombre: string
}

export type TaskHistoryEntry = {
  fecha_cambio: string
  cambiado_por: string
  tipo_cambio: 'EDICION' | 'ESTADO'
  valores_anteriores: Record<string, unknown>
  valores_nuevos: Record<string, unknown>
}

export type Treatment = {
  id: string
  bovino_id: string
  proxima_aplicacion: string | null
  observaciones: string | null
  bovino?: Pick<Bovine, 'nombre' | 'numero_diio' | 'identificador_interno'>
}

export type Weighing = {
  id: string
  bovino_id: string
  peso_kg: number
  fecha_pesaje: string
  es_inicial?: boolean
  created_at?: string
}

export type PendingWeighing = {
  bovino_id: string
  peso_kg: number
  fecha_pesaje: string
}

export type SaleHint = {
  bovine: Bovine
  status: 'falta_pesajes' | 'falta_parametros' | 'falta_costos' | 'rentable' | 'no_rentable'
  detail: string
  weighings: number
  currentWeight?: number
  recentGmd?: number | null
  acquisitionCost?: number
  maintenanceCost?: number
  accumulatedCost?: number
  expectedRevenue?: number
  margin?: number
  breakEvenPrice?: number
}

export type BovineAcquisitionCost = {
  id: string
  compra_id: string | null
  precio_compra_kilo: number | null
  costo_flete_asignado: number
}

export type SaleRecord = {
  id: string
  bovino_id: string
  identificador_interno: string
  nombre: string | null
  fecha_venta: string
  peso_salida_kg: number
  precio_kilo: number
  comprador_canal: string
  rentabilidad_calculada: number | null
  costo_compra_calculado: number | null
  mantenimiento_acumulado: number | null
}

export type SaleInput = {
  bovinoId: string
  fechaVenta: string
  pesoSalidaKg: number
  precioKilo: number
  compradorCanal: string
  mantenimientoDiario: number
}

export type SalePreview = {
  diasMantenimiento: number
  ingresoBruto: number
  costoCompra: number | null
  mantenimientoAcumulado: number
  rentabilidad: number | null
}

export type DashboardMetrics = {
  activeBulls: number
  averageGmd: number | null
  weeklyGmd: number | null
  pendingAlerts: number
}
