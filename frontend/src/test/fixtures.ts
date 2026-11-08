import type { Bovine, BovineAcquisitionCost, Weighing } from '../types/dashboard.ts'

export function bovine(partial: Partial<Bovine> & Pick<Bovine, 'id'>): Bovine {
  return {
    finca_id: 'finca-norte',
    numero_diio: null,
    identificador_interno: partial.id.toUpperCase(),
    nombre: null,
    raza: null,
    color: null,
    sexo: 'MACHO',
    estado: 'ACTIVO',
    ...partial,
  }
}

export function weighing(
  partial: Partial<Weighing> & Pick<Weighing, 'id' | 'fecha_pesaje' | 'peso_kg'>,
): Weighing {
  return {
    bovino_id: 'bt-010',
    ...partial,
  }
}

export function acquisition(
  partial: Partial<BovineAcquisitionCost> & Pick<BovineAcquisitionCost, 'id'>,
): BovineAcquisitionCost {
  return {
    compra_id: 'compra-1',
    precio_compra_kilo: 2000,
    costo_flete_asignado: 40_000,
    ...partial,
  }
}
