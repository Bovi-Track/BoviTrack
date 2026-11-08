import { describe, expect, it } from 'vitest'
import { daysBetween } from '../lib/dates.ts'
import { buildWeeklyReport, lifetimeGmd } from '../lib/gmd.ts'
import { bovine, weighing } from './fixtures.ts'

describe('UC-06 evolución de peso y GMD', () => {
  it('CP-GMD-01 la GMD es la diferencia de peso entre los días transcurridos', () => {
    const history = [
      weighing({ id: 'a', bovino_id: 'bt-001', fecha_pesaje: '2026-09-01', peso_kg: 400 }),
      weighing({ id: 'b', bovino_id: 'bt-001', fecha_pesaje: '2026-09-29', peso_kg: 456 }),
    ]

    expect(daysBetween('2026-09-01', '2026-09-29')).toBe(28)
    expect(lifetimeGmd(history)).toBe(2)
  })

  it('CP-GMD-02 dos capturas del mismo día no producen una GMD', () => {
    const history = [
      weighing({ id: 'a', bovino_id: 'bt-001', fecha_pesaje: '2026-10-01', peso_kg: 500 }),
      weighing({ id: 'b', bovino_id: 'bt-001', fecha_pesaje: '2026-10-01', peso_kg: 502 }),
    ]

    expect(lifetimeGmd(history)).toBeNull()
  })

  it('CP-GMD-03 un solo pesaje no calcula la GMD', () => {
    const history = [
      weighing({ id: 'a', bovino_id: 'bt-001', fecha_pesaje: '2026-10-01', peso_kg: 500 }),
    ]

    expect(lifetimeGmd(history)).toBeNull()
  })

  it('CP-GMD-04 los intervalos desiguales conservan sus días y su GMD', () => {
    const firstSpan = daysBetween('2026-09-01', '2026-09-08')
    const secondSpan = daysBetween('2026-09-08', '2026-10-06')

    expect(firstSpan).toBe(7)
    expect(secondSpan).toBe(28)
    expect(secondSpan / firstSpan).toBe(4)
    expect(lifetimeGmd([
      weighing({ id: 'a', fecha_pesaje: '2026-09-01', peso_kg: 400 }),
      weighing({ id: 'b', fecha_pesaje: '2026-09-08', peso_kg: 414 }),
    ])).toBe(2)
    expect(lifetimeGmd([
      weighing({ id: 'b', fecha_pesaje: '2026-09-08', peso_kg: 414 }),
      weighing({ id: 'c', fecha_pesaje: '2026-10-06', peso_kg: 470 }),
    ])).toBe(2)
  })

  it('CP-GMD-05 la evolución de un toro no usa los pesos de otro', () => {
    const report = buildWeeklyReport(
      [
        bovine({ id: 'bt-001', identificador_interno: 'BT-001' }),
        bovine({ id: 'bt-002', identificador_interno: 'BT-002' }),
      ],
      [
        weighing({ id: 'a', bovino_id: 'bt-001', fecha_pesaje: '2026-09-01', peso_kg: 400 }),
        weighing({ id: 'b', bovino_id: 'bt-001', fecha_pesaje: '2026-09-29', peso_kg: 456 }),
        weighing({ id: 'c', bovino_id: 'bt-002', fecha_pesaje: '2026-09-01', peso_kg: 300 }),
        weighing({ id: 'd', bovino_id: 'bt-002', fecha_pesaje: '2026-09-29', peso_kg: 310 }),
      ],
    )
    const first = report.bulls.find((item) => item.bovine.id === 'bt-001')
    const second = report.bulls.find((item) => item.bovine.id === 'bt-002')

    expect(first?.lastWeight).toBe(456)
    expect(first?.lifetimeGmd).toBe(2)
    expect(second?.lastWeight).toBe(310)
    expect(second?.lifetimeGmd).toBeCloseTo(10 / 28, 10)
  })
})
