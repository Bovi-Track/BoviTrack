export type Farm = {
  id: string
  nombre: string
  ubicacion: string | null
  activo: boolean
}

export type FarmRole = 'admin' | 'campo'

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
  numero_diio: string
  identificador_interno: string
  nombre: string | null
  raza: string | null
  sexo: 'MACHO' | 'HEMBRA'
  estado: 'ACTIVO' | 'INACTIVO' | 'VENDIDO' | 'BAJA' | 'MUERTO'
}

export type Task = {
  id: string
  titulo: string
  descripcion: string | null
  estado: string
  fecha_limite: string | null
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
}

export type PendingWeighing = {
  bovino_id: string
  peso_kg: number
  fecha_pesaje: string
}

export type SaleHint = {
  bovine: Bovine
  status: 'apto' | 'falta' | 'mantener'
  detail: string
}

export type DashboardMetrics = {
  activeBulls: number
  averageGmd: number | null
  pendingAlerts: number
}
