import { beforeEach, describe, expect, it } from 'vitest'
import { createPurchase } from '../lib/purchases.ts'
import { registerSale } from '../lib/sales.ts'
import { completeDisposalLoss, loadDisposals, registerDisposal } from '../lib/disposals.ts'
import { createBovines, updateBovine } from '../lib/bovines.ts'
import { createTask, loadTaskHistory, updateTask } from '../lib/tasks.ts'
import { loadBovineMovements, registerBovineMovement } from '../lib/bovine-movements.ts'
import { deactivateInventoryItem, loadInventoryReport, saveInventoryItem } from '../lib/inventory.ts'
import { removeSanitaryRecord } from '../lib/sanitary.ts'
import { loadBovineTraceability } from '../lib/bovine-traceability.ts'
import { saveReportPdf } from '../lib/report.ts'
import { setOnline } from './network.ts'

const purchase = {
  id_subasta: 'SUB-2026-014',
  numero_factura: 'FAC-88421',
  fecha_compra: '2026-03-15',
  costo_flete_total: 45000,
  proveedor: null,
  bovinos: [],
}

describe('operaciones que exigen internet', () => {
  beforeEach(() => {
    setOnline(false)
  })

  it.each([
    ['CP-COM-06 compra', () => createPurchase(purchase)],
    ['CP-VTA-07 venta', () => registerSale({
      bovinoId: 'bt-001', fechaVenta: '2026-10-31', pesoSalidaKg: 520,
      precioKilo: 2200, compradorCanal: 'Canal Camacho', mantenimientoDiario: 1500,
    })],
    ['CP-BAJ-05 baja', () => registerDisposal('bt-001', '2026-10-31', 'infección', null)],
    ['CP-BAJ-02 completar pérdida', () => completeDisposalLoss('baja-1', 1500)],
    ['CP-BAJ-03 consulta de baja', () => loadDisposals('bt-001')],
    ['CP-FINC-06 movimiento', () => registerBovineMovement({
      bovineId: 'bt-001', originId: 'finca-norte', destinationId: 'finca-sur',
      kind: 'TRASLADO', date: '2026-10-20', notes: '', operationId: 'op-1',
    })],
    ['CP-FINC-01 consulta de movimientos', () => loadBovineMovements('finca-norte', null)],
    ['CP-BOV-01 alta de toro', () => createBovines([])],
    ['CP-BOV-02 edición de toro', () => updateBovine('bt-001', {
      identificador_interno: 'BT-001', nombre: null, raza: null, color: null,
    })],
    ['CP-TAR-06 crear tarea', () => createTask('finca-norte', 'Pesaje', null, null, null)],
    ['CP-TAR-01 editar tarea', () => updateTask('tarea-1', 'Pesaje', null, null, null)],
    ['CP-TAR-01 historial de tarea', () => loadTaskHistory('tarea-1')],
    ['CP-INS-01 guardar insumo', () => saveInventoryItem('finca-norte', {
      nombre: 'Melaza', tipo: 'ALIMENTO', unidad_medida: 'kg',
    })],
    ['CP-INS-01 desactivar insumo', () => deactivateInventoryItem('insumo-1')],
    ['CP-REP-01 reporte de inventario', () => loadInventoryReport('finca-norte', '2026-09-01', '2026-10-31')],
    ['CP-REP-04 descarga PDF', () => saveReportPdf(new Blob(['%PDF']), 'reporte.pdf', 'finca-norte')],
    ['CP-SAN-01 borrar sanidad', () => removeSanitaryRecord('san-1')],
    ['CP-TRAZ-01 trazabilidad', () => loadBovineTraceability('bt-001')],
  ])('%s no se encola sin conexión', async (_name, run) => {
    await expect(run()).rejects.toThrow(/conexión a internet/)
  })
})
