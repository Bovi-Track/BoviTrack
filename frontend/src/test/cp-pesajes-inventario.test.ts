import { describe, expect, it } from 'vitest'
import { inventoryErrorMessage, parseInventoryQuantity, validateInventoryPeriod } from '../lib/inventory.ts'
import { saveWeighing } from '../lib/weighings.ts'
import { projectOperation } from '../offline/project.ts'
import type { CachedData, OfflineOperation } from '../offline/types.ts'

function stockAfter(stock: number, tipo: string, cantidad: number) {
  const entry: CachedData = {
    key: 'inventory:finca-norte',
    user_id: 'campo-norte',
    farm_id: 'finca-norte',
    value: [{ id: 'coquito', stock }],
  }
  const operation: OfflineOperation = {
    id: `op-${tipo}-${cantidad}-${stock}`,
    userId: 'campo-norte',
    farmId: 'finca-norte',
    kind: 'inventory',
    payload: { insumo_id: 'coquito', tipo, cantidad },
    optimistic: { pending: true },
    state: 'pending',
    error: null,
    createdAt: '2026-10-31T12:00:00.000Z',
  }
  const next = projectOperation(entry, operation, operation.optimistic) as Array<{ stock: number }>
  return next[0].stock
}

describe('UC-05 pesajes', () => {
  it('CP-PES-02 rechaza peso cero o negativo antes de guardarlo', async () => {
    await expect(saveWeighing(
      { bovino_id: 'bt-001', peso_kg: 0, fecha_pesaje: '2026-10-17' },
      'finca-norte',
    )).rejects.toThrow('Error: El peso ingresado está fuera de rango')
    await expect(saveWeighing(
      { bovino_id: 'bt-001', peso_kg: -10, fecha_pesaje: '2026-10-17' },
      'finca-norte',
    )).rejects.toThrow('Error: El peso ingresado está fuera de rango')
  })

  it('CP-PES-05 la misma captura no se agrega dos veces al historial local', () => {
    const entry: CachedData = {
      key: 'weighings:finca-norte',
      user_id: 'campo-norte',
      farm_id: 'finca-norte',
      value: [],
    }
    const optimistic = {
      id: 'captura-1',
      bovino_id: 'bt-001',
      peso_kg: 490,
      fecha_pesaje: '2026-10-19',
    }
    const operation: OfflineOperation = {
      id: 'captura-1',
      userId: 'campo-norte',
      farmId: 'finca-norte',
      kind: 'weighing',
      payload: optimistic,
      optimistic,
      state: 'pending',
      error: null,
      createdAt: '2026-10-19T12:00:00.000Z',
    }
    const once = projectOperation(entry, operation, optimistic) as unknown[]
    const twice = projectOperation(
      { ...entry, value: once },
      operation,
      optimistic,
    ) as unknown[]

    expect(once).toHaveLength(1)
    expect(twice).toHaveLength(1)
  })
})

describe('UC-09 inventario', () => {
  it('CP-INV-01 entrada, consumo, salida y ajuste dejan el saldo esperado', () => {
    const despuesDeEntrada = stockAfter(0, 'ENTRADA', 100)
    const despuesDeConsumo = stockAfter(despuesDeEntrada, 'CONSUMO', 30)
    const despuesDeSalida = stockAfter(despuesDeConsumo, 'SALIDA', 20)
    const despuesDeAjuste = stockAfter(despuesDeSalida, 'AJUSTE_NEGATIVO', 10)

    expect(despuesDeEntrada).toBe(100)
    expect(despuesDeConsumo).toBe(70)
    expect(despuesDeSalida).toBe(50)
    expect(despuesDeAjuste).toBe(40)
  })

  it('CP-INV-02 rechaza cantidades que no son positivas', () => {
    expect(() => parseInventoryQuantity('0')).toThrow(/mayor que cero|positiva/)
    expect(() => parseInventoryQuantity('-5')).toThrow(/positiva/)
    expect(() => parseInventoryQuantity('80')).not.toThrow()
    expect(parseInventoryQuantity('30')).toBe(30)
  })

  it('CP-INV-03 la misma proyección de un consumo no descuenta dos veces', () => {
    const entry: CachedData = {
      key: 'inventory:finca-norte',
      user_id: 'campo-norte',
      farm_id: 'finca-norte',
      value: [{ id: 'coquito', stock: 10 }],
    }
    const operation: OfflineOperation = {
      id: 'consumo-1',
      userId: 'campo-norte',
      farmId: 'finca-norte',
      kind: 'inventory',
      payload: { insumo_id: 'coquito', tipo: 'CONSUMO', cantidad: 8 },
      optimistic: { pending: true },
      state: 'pending',
      error: null,
      createdAt: '2026-10-31T12:00:00.000Z',
    }
    const once = projectOperation(entry, operation, operation.optimistic) as Array<{ stock: number }>
    const repeated = projectOperation(entry, operation, operation.optimistic) as Array<{ stock: number }>

    expect(once[0].stock).toBe(2)
    expect(repeated[0].stock).toBe(2)
  })

  it('CP-INV-05 un movimiento de otra finca no cambia el saldo local', () => {
    const entry: CachedData = {
      key: 'inventory:finca-norte',
      user_id: 'campo-norte',
      farm_id: 'finca-norte',
      value: [{ id: 'coquito', stock: 40 }],
    }
    const operation: OfflineOperation = {
      id: 'ajeno',
      userId: 'campo-sur',
      farmId: 'finca-sur',
      kind: 'inventory',
      payload: { insumo_id: 'coquito', tipo: 'CONSUMO', cantidad: 10 },
      optimistic: { pending: true },
      state: 'pending',
      error: null,
      createdAt: '2026-10-31T12:00:00.000Z',
    }

    const next = projectOperation(entry, operation, operation.optimistic) as Array<{ stock: number }>
    expect(next[0].stock).toBe(40)
  })

  it('CP-INS-02 un nombre duplicado en la finca se rechaza, incluso entre inactivos', () => {
    expect(inventoryErrorMessage({
      code: '23505',
      message: 'duplicate key value violates insumo_finca_nombre_unico_idx',
    })).toMatch(/incluso entre los inactivos/)
  })
})
