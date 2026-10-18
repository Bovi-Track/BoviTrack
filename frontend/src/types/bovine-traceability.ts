export type BovineTraceEventKind = 'COMPRA' | 'MOVIMIENTO' | 'PESAJE' | 'SANIDAD' | 'VENTA' | 'BAJA'

export type BovineTraceEvent = {
  evento_id: string
  tipo_evento: BovineTraceEventKind
  fecha_evento: string
  registrado_en: string | null
  titulo: string
  detalle: string | null
  responsable: string
}
