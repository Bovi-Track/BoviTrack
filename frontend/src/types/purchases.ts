export type PurchaseBovineInput = {
  finca_id: string
  numero_diio: string
  identificador_interno: string
  nombre: string | null
  raza: string | null
  color: string | null
  sexo: 'MACHO' | 'HEMBRA'
  fecha_nacimiento: string | null
  fecha_ingreso: string | null
  peso_compra_kg: number
  precio_compra_kilo: number
}

export type CreatePurchaseInput = {
  id_subasta: string | null
  numero_factura: string
  fecha_compra: string
  costo_flete_total: number
  proveedor: string | null
  bovinos: PurchaseBovineInput[]
}

export type PurchaseBovineResult = {
  id: string
  finca_id: string
  numero_diio: string
  peso_compra_kg: number
  precio_compra_kilo: number
  costo_flete_asignado: number
  costo_inicial: number
}

export type PurchaseResult = {
  compra_id: string
  numero_factura: string
  cantidad_bovinos: number
  peso_total_kg: number
  subtotal_animales: number
  costo_flete_total: number
  costo_inicial_total: number
  bovinos: PurchaseBovineResult[]
}
