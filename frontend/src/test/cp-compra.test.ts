import { describe, expect, it } from 'vitest'
import { bovineErrorMessage } from '../lib/bovines.ts'
import { calculatePurchasePreview, purchaseErrorMessage } from '../lib/purchases.ts'

function cents(value: number) {
  return Math.round(value * 100)
}

describe('UC-01 compra de ganado', () => {
  it('CP-COM-01 reparte el flete proporcional al peso y conserva el total', () => {
    const preview = calculatePurchasePreview(
      [
        { peso_compra_kg: 420, precio_compra_kilo: 1850 },
        { peso_compra_kg: 380, precio_compra_kilo: 1850 },
      ],
      45_000,
    )

    expect(preview.lines[0]).toEqual({
      baseCost: 777_000,
      freightShare: 23_625,
      initialCost: 800_625,
    })
    expect(preview.lines[1]).toEqual({
      baseCost: 703_000,
      freightShare: 21_375,
      initialCost: 724_375,
    })
    expect(cents(preview.lines[0].freightShare + preview.lines[1].freightShare)).toBe(4_500_000)
    expect(preview.freightTotal).toBe(45_000)
  })

  it('CP-COM-02 el redondeo a céntimos no altera el flete de ₡100,00', () => {
    const preview = calculatePurchasePreview(
      [
        { peso_compra_kg: 300, precio_compra_kilo: 1000 },
        { peso_compra_kg: 300, precio_compra_kilo: 1000 },
        { peso_compra_kg: 300, precio_compra_kilo: 1000 },
      ],
      100,
    )
    const shares = preview.lines.map((line) => cents(line.freightShare)).sort((a, b) => a - b)

    expect(shares).toEqual([3333, 3333, 3334])
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(10_000)
    expect(preview.lines.map((line) => cents(line.initialCost)).sort((a, b) => a - b)).toEqual([
      30_003_333, 30_003_333, 30_003_334,
    ])
  })

  it('CP-COM-03 un identificador duplicado se informa y no se trata como un fallo genérico', () => {
    expect(purchaseErrorMessage({ code: '23505', message: 'duplicate key' })).toBe(
      'Ya existe un bovino con ese número DIIO o identificador interno.',
    )
    expect(bovineErrorMessage({ code: '23505', message: 'duplicate key' })).toBe(
      'Ya existe un bovino con ese número DIIO o identificador interno.',
    )
  })

  it('CP-COM-04 un flete explícito de cero no suma transporte', () => {
    const preview = calculatePurchasePreview(
      [{ peso_compra_kg: 400, precio_compra_kilo: 2000 }],
      0,
    )

    expect(preview.lines[0].freightShare).toBe(0)
    expect(preview.lines[0].initialCost).toBe(800_000)
    expect(preview.freightTotal).toBe(0)
  })
})
