import { beforeEach, describe, expect, it } from 'vitest'
import { SANITARY_KINDS } from '../types/sanitary.ts'
import { createSanitaryRecord } from '../lib/sanitary.ts'
import { registerInventoryMovement } from '../lib/inventory.ts'
import { saveWeighing } from '../lib/weighings.ts'
import { loadTasks } from '../lib/tasks.ts'
import { setOfflineUser } from '../offline/runtime.ts'
import { operations, writeCache } from '../offline/store.ts'
import { wipeOfflineDatabase } from './offline-db.ts'
import { setOnline } from './network.ts'

const USER = 'campo-norte'
const FARM = 'finca-norte'

describe('capturas locales de campo', () => {
  beforeEach(async () => {
    setOnline(false)
    setOfflineUser(null)
    await wipeOfflineDatabase()
    await writeCache(USER, 'farms', null, [
      { farm: { id: FARM, activo: true }, role: 'campo' },
    ])
    setOfflineUser(USER)
  })

  it('CP-SAN-01 guarda las cuatro categorías con producto, dosis, fecha y usuario', async () => {
    for (const tipo of SANITARY_KINDS) {
      await createSanitaryRecord('bt-001', tipo, 'Producto', '5', '2026-10-10', '2026-11-10', null, null, FARM)
    }
    const pending = await operations(USER)
    expect(pending).toHaveLength(4)
    expect(pending.map((item) => item.payload.tipo).sort()).toEqual([...SANITARY_KINDS].sort())
    expect(pending.every((item) => item.userId === USER && item.payload.dosis === '5')).toBe(true)
  })

  it('CP-SAN-02 rechaza la próxima aplicación igual o anterior antes de encolar', async () => {
    await expect(createSanitaryRecord(
      'bt-001', 'VACUNACION', 'Clostridial', '5', '2026-10-10', '2026-10-10', null, null, FARM,
    )).rejects.toThrow(/posterior/)
    await expect(createSanitaryRecord(
      'bt-001', 'VACUNACION', 'Clostridial', '5', '2026-10-10', '2026-10-09', null, null, FARM,
    )).rejects.toThrow(/posterior/)
    await expect(createSanitaryRecord(
      'bt-001', 'VACUNACION', '', '0', '2026-10-10', null, null, null, FARM,
    )).rejects.toThrow(/dosis positiva/)
    expect(await operations(USER)).toHaveLength(0)
  })

  it('CP-PES-01 guarda un pesaje positivo a nombre del usuario autenticado', async () => {
    const saved = await saveWeighing({ bovino_id: 'bt-001', peso_kg: 485, fecha_pesaje: '2026-10-17' }, FARM)
    const [pending] = await operations(USER)
    expect(saved.pending).toBe(true)
    expect(pending.userId).toBe(USER)
    expect(pending.payload).toMatchObject({ bovino_id: 'bt-001', peso_kg: 485, fecha_pesaje: '2026-10-17' })
  })

  it('CP-INV-02 no encola un consumo que dejaría el saldo negativo', async () => {
    await expect(registerInventoryMovement('coquito', {
      tipo: 'CONSUMO', cantidad: '80', fecha: '2026-10-31', observaciones: '',
    }, FARM, 40)).rejects.toThrow(/Saldo insuficiente/)
    expect(await operations(USER)).toHaveLength(0)
  })

  it('CP-INV-01 un consumo válido queda en la cola con el saldo proyectado', async () => {
    const saved = await registerInventoryMovement('coquito', {
      tipo: 'CONSUMO', cantidad: '30', fecha: '2026-10-31', observaciones: 'corral',
    }, FARM, 100)
    expect(saved.data.stock).toBe(70)
    expect(await operations(USER)).toHaveLength(1)
  })

  it('CP-TAR-03 y CP-TAR-04 el personal solo ve sus tareas asignadas', async () => {
    await writeCache(USER, `tasks:${FARM}`, FARM, [
      { id: 'propia', titulo: 'Pesaje', descripcion: '', estado: 'PENDIENTE', fecha_limite: '2026-10-31', asignada_a: USER, asignada_nombre: 'Campo' },
      { id: 'ajena', titulo: 'Otro', descripcion: '', estado: 'PENDIENTE', fecha_limite: '2026-10-31', asignada_a: 'otro', asignada_nombre: 'Otro' },
      { id: 'libre', titulo: 'Sin asignar', descripcion: '', estado: 'PENDIENTE', fecha_limite: '2026-10-31', asignada_a: null, asignada_nombre: '' },
    ])
    const own = await loadTasks(FARM)
    expect(own.map((task) => task.id)).toEqual(['propia'])

    await writeCache(USER, 'farms', null, [
      { farm: { id: FARM, activo: true }, role: 'admin' },
    ])
    const all = await loadTasks(FARM)
    expect(all).toHaveLength(3)
  })
})
