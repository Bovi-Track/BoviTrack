import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeMetrics } from '../lib/dashboard.ts'
import { todayIso } from '../lib/dates.ts'
import { validateInventoryPeriod } from '../lib/inventory.ts'
import { planStatus } from '../lib/sanitary.ts'
import { requireConnection } from '../offline/runtime.ts'
import { projectOperation } from '../offline/project.ts'
import type { CachedData, OfflineOperation } from '../offline/types.ts'
import type { SanitaryRecord } from '../types/sanitary.ts'

function record(proxima: string): SanitaryRecord {
  return {
    id: 'san-1',
    bovino_id: 'bt-001',
    tipo: 'VACUNACION',
    producto: 'Clostridial',
    dosis: '5',
    fecha: '2026-10-10',
    proxima,
    responsable: 'campo-norte',
    observaciones: '',
  }
}

describe('UC-07 plan sanitario', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('CP-SAN-04 a las 18:05 la fecha operativa sigue siendo el día local', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 31, 18, 5, 0))

    expect(todayIso()).toBe('2026-10-31')
    expect(planStatus(record('2026-10-31'))).not.toBe('vencido')
    expect(computeMetrics([], [], [
      { id: 'hoy', bovino_id: 'bt-001', proxima_aplicacion: '2026-10-31', observaciones: null },
      { id: 'manana', bovino_id: 'bt-001', proxima_aplicacion: '2026-11-01', observaciones: null },
    ]).pendingAlerts).toBe(1)

    const utcDay = new Date().toISOString().slice(0, 10)
    if (utcDay === '2026-11-01') {
      expect(todayIso()).toBe('2026-10-31')
    }
  })
})

describe('RF-TR-03 reportes', () => {
  it('CP-REP-02 rechaza un periodo con la fecha inicial posterior a la final', () => {
    expect(() => validateInventoryPeriod('2026-10-31', '2026-09-01')).toThrow(/Desde menor o igual/)
  })

  it('CP-REP-01 acepta un periodo inclusivo en sus dos extremos', () => {
    expect(() => validateInventoryPeriod('2026-09-01', '2026-10-31')).not.toThrow()
    expect(() => validateInventoryPeriod('2026-10-31', '2026-10-31')).not.toThrow()
  })
})

describe('Offline-First', () => {
  it('CP-OFF-06 una operación que exige internet se rechaza sin conexión', () => {
    const previous = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    try {
      expect(() => requireConnection()).toThrow(/conexión a internet/)
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => previous })
    }
  })

  it('CP-OFF-02 una captura de otra finca no altera la copia local', () => {
    const entry: CachedData = {
      key: 'weighings:finca-norte',
      user_id: 'campo-norte',
      farm_id: 'finca-norte',
      value: [{ id: 'previo', bovino_id: 'bt-001', peso_kg: 480, fecha_pesaje: '2026-10-17' }],
    }
    const operation: OfflineOperation = {
      id: 'ajena',
      userId: 'admin-sur',
      farmId: 'finca-sur',
      kind: 'weighing',
      payload: {},
      optimistic: { id: 'ajena', bovino_id: 'bt-201', peso_kg: 300, fecha_pesaje: '2026-10-21' },
      state: 'pending',
      error: null,
      createdAt: '2026-10-21T12:00:00.000Z',
    }

    expect(projectOperation(entry, operation, operation.optimistic)).toEqual(entry.value)
  })

  it('CP-TAR-05 el cambio de estado de una tarea se proyecta una sola vez', () => {
    const entry: CachedData = {
      key: 'tasks:finca-norte',
      user_id: 'campo-norte',
      farm_id: 'finca-norte',
      value: [{ id: 'tarea-1', estado: 'PENDIENTE' }],
    }
    const operation: OfflineOperation = {
      id: 'estado-1',
      userId: 'campo-norte',
      farmId: 'finca-norte',
      kind: 'task',
      payload: { id: 'tarea-1', estado: 'COMPLETADA' },
      optimistic: { id: 'tarea-1', estado: 'COMPLETADA' },
      state: 'pending',
      error: null,
      createdAt: '2026-10-31T18:00:00.000Z',
    }
    const once = projectOperation(entry, operation, operation.optimistic) as Array<{ estado: string }>
    const twice = projectOperation({ ...entry, value: once }, operation, operation.optimistic) as Array<{ estado: string }>

    expect(once).toEqual([{ id: 'tarea-1', estado: 'COMPLETADA' }])
    expect(twice).toEqual([{ id: 'tarea-1', estado: 'COMPLETADA' }])
  })
})
