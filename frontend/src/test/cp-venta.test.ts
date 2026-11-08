import { describe, expect, it } from 'vitest'
import { daysBetween } from '../lib/dates.ts'
import { calculateSalePreview } from '../lib/sales.ts'
import { acquisition, bovine, weighing } from './fixtures.ts'

const toro = bovine({
  id: 'bt-001',
  identificador_interno: 'BT-001',
  numero_diio: 'CR100420',
  fecha_ingreso: '2026-08-01',
})

const costos = acquisition({
  id: 'bt-001',
  precio_compra_kilo: 2000,
  costo_flete_asignado: 40_000,
})

const inicial = [
  weighing({
    id: 'inicial',
    bovino_id: 'bt-001',
    fecha_pesaje: '2026-08-01',
    peso_kg: 400,
    es_inicial: true,
  }),
]

describe('UC-12 venta de un toro', () => {
  it('CP-VTA-01 calcula la rentabilidad con costo diario explícito', () => {
    const preview = calculateSalePreview(toro, costos, inicial, '2026-10-31', 520, 2200, 1500)

    expect(daysBetween('2026-08-01', '2026-10-31')).toBe(91)
    expect(preview).toEqual({
      diasMantenimiento: 91,
      ingresoBruto: 1_144_000,
      costoCompra: 840_000,
      mantenimientoAcumulado: 136_500,
      rentabilidad: 167_500,
    })
  })

  it('CP-VTA-02 un costo diario explícito de cero es un dato válido', () => {
    const preview = calculateSalePreview(toro, costos, inicial, '2026-10-31', 520, 2200, 0)

    expect(preview?.mantenimientoAcumulado).toBe(0)
    expect(preview?.rentabilidad).toBe(304_000)
  })

  it('CP-VTA-03 un costo diario vacío no se interpreta como cero', () => {
    expect(calculateSalePreview(toro, costos, inicial, '2026-10-31', 520, 2200, Number.NaN)).toBeNull()
  })

  it('CP-VTA-04 sin costos de compra no presenta una rentabilidad completa', () => {
    const preview = calculateSalePreview(toro, undefined, inicial, '2026-10-31', 520, 2200, 1500)

    expect(preview?.ingresoBruto).toBe(1_144_000)
    expect(preview?.costoCompra).toBeNull()
    expect(preview?.rentabilidad).toBeNull()
  })

  it('CP-VTA-06 un peso de salida no positivo no arma la venta', () => {
    expect(calculateSalePreview(toro, costos, inicial, '2026-10-31', 0, 2200, 1500)).toBeNull()
    expect(calculateSalePreview(toro, costos, inicial, '2026-10-31', -5, 2200, 1500)).toBeNull()
  })
})
