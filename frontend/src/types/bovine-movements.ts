import type { BovineStatus } from './dashboard.ts'

export type BovineMovementKind = 'ASIGNACION' | 'RETIRO' | 'TRASLADO'

export type BovineMovement = {
  id: string
  bovino_id: string
  identificador_interno: string
  nombre: string | null
  tipo: BovineMovementKind
  finca_origen_id: string | null
  finca_origen_nombre: string | null
  finca_destino_id: string | null
  finca_destino_nombre: string | null
  fecha_movimiento: string
  observaciones: string | null
  registrado_por: string | null
  responsable: string | null
  created_at: string
}

export type BovineMovementInput = {
  bovineId: string
  originId: string
  kind: BovineMovementKind
  destinationId: string | null
  date: string
  notes: string
  operationId: string
}

export type BovineMovementResult = {
  id: string
  bovino_id: string
  finca_id: string
  estado: BovineStatus
}
