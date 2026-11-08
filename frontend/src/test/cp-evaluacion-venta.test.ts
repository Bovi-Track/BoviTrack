import { describe, expect, it } from 'vitest'
import { daysBetween } from '../lib/dates.ts'
import { saleHints, saleWeighingCount } from '../lib/dashboard.ts'
import { acquisition, bovine, weighing } from './fixtures.ts'

const CONSULTA = '2026-10-31'
const BULL = 'bt-010'

const OCHO_FECHAS: Array<[string, number]> = [
  ['2026-09-05', 464],
  ['2026-09-12', 472],
  ['2026-09-19', 480],
  ['2026-09-26', 488],
  ['2026-10-03', 496],
  ['2026-10-10', 504],
  ['2026-10-17', 512],
  ['2026-10-31', 520],
]

function serie(rows: Array<[string, number]>, extra: ReturnType<typeof weighing>[] = []) {
  return [
    weighing({
      id: 'inicial',
      bovino_id: BULL,
      fecha_pesaje: '2026-08-22',
      peso_kg: 400,
      es_inicial: true,
    }),
    ...rows.map(([fecha, peso], index) => weighing({
      id: `p-${index}`,
      bovino_id: BULL,
      fecha_pesaje: fecha,
      peso_kg: peso,
    })),
    ...extra,
  ]
}

function evaluar(
  rows: Array<[string, number]>,
  inputs: { expectedPricePerKg: number | null; maintenancePerDay: number | null },
  extra: ReturnType<typeof weighing>[] = [],
) {
  return saleHints(
    [bovine({ id: BULL, identificador_interno: 'BT-010', fecha_ingreso: '2026-08-22' })],
    serie(rows, extra),
    [acquisition({ id: BULL })],
    inputs,
    CONSULTA,
  )[0]
}

describe('UC-10 evaluación de conveniencia de venta', () => {
  it('CP-VEN-01 siete fechas distintas, incluido el día de consulta, no alcanzan', () => {
    const siete = OCHO_FECHAS.slice(1)
    const hint = evaluar(siete, { expectedPricePerKg: 2200, maintenancePerDay: 1500 })

    expect(saleWeighingCount(serie(siete), CONSULTA)).toBe(7)
    expect(hint.status).toBe('falta_pesajes')
    expect(hint.weighings).toBe(7)
    expect(hint.margin).toBeUndefined()
  })

  it('CP-VEN-02 dos capturas del mismo día cuentan como una fecha', () => {
    const siete = OCHO_FECHAS.slice(1)
    const repetido = weighing({
      id: 'repetido',
      bovino_id: BULL,
      fecha_pesaje: '2026-10-17',
      peso_kg: 500,
    })

    expect(saleWeighingCount(serie(siete, [repetido]), CONSULTA)).toBe(7)
    expect(evaluar(siete, { expectedPricePerKg: 2200, maintenancePerDay: 1500 }, [repetido]).status)
      .toBe('falta_pesajes')
  })

  it('CP-VEN-03 un pesaje anterior a la ventana no completa las ocho fechas', () => {
    const siete = OCHO_FECHAS.slice(1)
    const fuera = weighing({
      id: 'fuera',
      bovino_id: BULL,
      fecha_pesaje: '2026-09-04',
      peso_kg: 450,
    })

    expect(daysBetween('2026-09-04', CONSULTA)).toBe(57)
    expect(saleWeighingCount(serie(siete, [fuera]), CONSULTA)).toBe(7)
  })

  it('CP-VEN-03 el pesaje del día límite, 56 días antes, sí entra en la ventana', () => {
    const sieteSinHoy = OCHO_FECHAS.slice(0, 7)
    const conLimite = serie(sieteSinHoy)

    expect(daysBetween('2026-09-05', CONSULTA)).toBe(56)
    expect(saleWeighingCount(conLimite, CONSULTA)).toBe(7)
    expect(saleWeighingCount(serie(OCHO_FECHAS), CONSULTA)).toBe(8)
  })

  it('CP-VEN-04 con ocho fechas y precio ₡2.200/kg la venta de hoy es rentable', () => {
    const hint = evaluar(OCHO_FECHAS, { expectedPricePerKg: 2200, maintenancePerDay: 1500 })

    expect(daysBetween('2026-08-22', CONSULTA)).toBe(70)
    expect(hint.status).toBe('rentable')
    expect(hint.currentWeight).toBe(520)
    expect(hint.recentGmd).toBe(1)
    expect(hint.acquisitionCost).toBe(840_000)
    expect(hint.maintenanceCost).toBe(105_000)
    expect(hint.accumulatedCost).toBe(945_000)
    expect(hint.expectedRevenue).toBe(1_144_000)
    expect(hint.margin).toBe(199_000)
    expect(hint.breakEvenPrice).toBeCloseTo(945_000 / 520, 8)
    expect(hint.weighings).toBe(8)
  })

  it('CP-VEN-05 con precio ₡1.700/kg el ingreso no cubre el costo acumulado', () => {
    const hint = evaluar(OCHO_FECHAS, { expectedPricePerKg: 1700, maintenancePerDay: 1500 })

    expect(hint.status).toBe('no_rentable')
    expect(hint.expectedRevenue).toBe(884_000)
    expect(hint.margin).toBe(-61_000)
    expect(hint.breakEvenPrice).toBeCloseTo(945_000 / 520, 8)
  })

  it('CP-VEN-06 el precio y el costo diario vacíos no se sustituyen por cero', () => {
    const sinPrecio = evaluar(OCHO_FECHAS, { expectedPricePerKg: null, maintenancePerDay: 1500 })
    const sinCosto = evaluar(OCHO_FECHAS, { expectedPricePerKg: 2200, maintenancePerDay: null })
    const ceroExplicito = evaluar(OCHO_FECHAS, { expectedPricePerKg: 2200, maintenancePerDay: 0 })

    expect(sinPrecio.status).toBe('falta_parametros')
    expect(sinPrecio.margin).toBeUndefined()
    expect(sinCosto.status).toBe('falta_parametros')
    expect(ceroExplicito.status).toBe('rentable')
    expect(ceroExplicito.maintenanceCost).toBe(0)
    expect(ceroExplicito.accumulatedCost).toBe(840_000)
    expect(ceroExplicito.margin).toBe(304_000)
  })

  it('CP-VEN-06 sin costos de compra no se calcula una rentabilidad en cero', () => {
    const hint = saleHints(
      [bovine({ id: BULL, fecha_ingreso: '2026-08-22' })],
      serie(OCHO_FECHAS),
      [],
      { expectedPricePerKg: 2200, maintenancePerDay: 1500 },
      CONSULTA,
    )[0]

    expect(hint.status).toBe('falta_costos')
    expect(hint.margin).toBeUndefined()
  })

  it('CP-VEN-07 un toro que no está activo no recibe sugerencia de venta', () => {
    const hints = saleHints(
      [bovine({ id: BULL, estado: 'VENDIDO', fecha_ingreso: '2026-08-22' })],
      serie(OCHO_FECHAS),
      [acquisition({ id: BULL })],
      { expectedPricePerKg: 2200, maintenancePerDay: 1500 },
      CONSULTA,
    )

    expect(hints).toEqual([])
  })
})
