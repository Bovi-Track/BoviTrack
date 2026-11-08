import { describe, expect, it } from 'vitest'
import { buildReportPdf, defaultReportSelection, suggestedReportFilename } from '../lib/report.ts'
import { parseInventoryReport } from '../lib/inventory.ts'
import { bovineLabel, bovineStatusLabel } from '../lib/bovines.ts'
import { formatKg } from '../lib/gmd.ts'
import { isValidIsoDate } from '../lib/dates.ts'
import { mensajeAuth } from '../auth/service.ts'
import { passwordIssues } from '../lib/passwordPolicy.ts'
import { bovine } from './fixtures.ts'
import type { SaleRecord } from '../types/dashboard.ts'

const toro = bovine({ id: 'bt-001', identificador_interno: 'BT-001', nombre: 'Estero' })

const ventaSinCompra: SaleRecord = {
  id: 'venta-1',
  bovino_id: 'bt-001',
  identificador_interno: 'BT-001',
  nombre: 'Estero',
  fecha_venta: '2026-10-31',
  peso_salida_kg: 520,
  precio_kilo: 2200,
  comprador_canal: 'Canal Camacho',
  rentabilidad_calculada: null,
  costo_compra_calculado: null,
  mantenimiento_acumulado: 136500,
}

describe('reportes y reglas de presentación', () => {
  it('CP-REP-01 el PDF incluye las secciones y marca la compra ausente como no disponible', async () => {
    const selection = {
      ...defaultReportSelection(),
      inventario: false,
    }
    const blob = buildReportPdf({
      farmName: 'Finca Norte',
      farmLocation: 'Guápiles',
      generatedAt: '2026-10-31T18:05:00.000Z',
      bovines: [toro],
      weighings: [],
      treatments: [],
      sanitaryRecords: [],
      sales: [ventaSinCompra],
      period: { desde: '2026-09-01', hasta: '2026-10-31' },
    }, selection)
    const text = await blob.text()

    expect(suggestedReportFilename('Finca Norte', '2026-10-31T18:05:00.000Z')).toBe(
      'BoviTrack-Finca-Norte-2026-10-31.pdf',
    )
    expect(text).toContain('BOVITRACK')
    expect(text).toContain('No hay pesajes registrados')
    expect(text).toContain('No hay aplicaciones sanitarias')
    expect(text).toMatch(/\(No\)[\s\S]{0,80}\(disponible\)/)
    expect(text).toContain('(CRC)')
  })

  it('CP-REP-03 un reporte de inventario vacío se admite si el saldo cuadra', () => {
    const report = parseInventoryReport({
      finca_id: 'finca-norte',
      finca_nombre: 'Finca Norte',
      desde: '2020-01-01',
      hasta: '2020-01-31',
      resumen: [],
      movimientos: [],
    })
    expect(report.movimientos).toEqual([])
    expect(() => parseInventoryReport({
      finca_id: 'finca-norte',
      finca_nombre: 'Finca Norte',
      desde: '2026-10-31',
      hasta: '2026-09-01',
      resumen: [],
      movimientos: [],
    })).toThrow(/Desde menor o igual/)
  })

  it('CP-INV-04 el reporte rechaza un saldo que no cuadra con los movimientos', () => {
    expect(() => parseInventoryReport({
      finca_id: 'finca-norte',
      finca_nombre: 'Finca Norte',
      desde: '2026-09-01',
      hasta: '2026-10-31',
      resumen: [{
        insumo_id: 'coquito', nombre: 'Coquito', tipo: 'ALIMENTO', unidad_medida: 'kg',
        activo: true, saldo_inicial: 0, entradas: 100, salidas: 0, consumos: 30,
        ajustes_positivos: 0, ajustes_negativos: 0, saldo_final: 0,
      }],
      movimientos: [],
    })).toThrow()
  })

  it('CP-BOV-03 las etiquetas distinguen vendido y baja', () => {
    expect(bovineStatusLabel('VENDIDO')).toBe('Vendido')
    expect(bovineStatusLabel('BAJA')).toBe('Baja')
    expect(bovineLabel(toro)).toBe('Estero · BT-001')
    expect(formatKg(null)).toBe('—')
    expect(isValidIsoDate('2026-02-31')).toBe(false)
  })

  it('CP-AUTH-02 y CP-AUTH-03 traducen credenciales y una contraseña corta', () => {
    expect(mensajeAuth('Email not confirmed')).toMatch(/Confirma tu correo/)
    expect(mensajeAuth('Too many requests')).toMatch(/Demasiados intentos/)
    expect(passwordIssues('abc12').some((issue) => /8 caracteres|minúscula|mayúscula|número|símbolo/i.test(issue))).toBe(true)
  })
})
