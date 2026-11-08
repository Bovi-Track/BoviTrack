import { beforeEach, describe, expect, it } from 'vitest'
import { offlineUser, setOfflineUser } from '../offline/runtime.ts'
import {
  acknowledge,
  closeOfflineDatabase,
  enqueue,
  operations,
  readCache,
  writeCache,
} from '../offline/store.ts'
import type { OfflineOperation } from '../offline/types.ts'
import { wipeOfflineDatabase } from './offline-db.ts'
import { setOnline } from './network.ts'

const USER = 'campo-norte'
const OTHER = 'admin-sur'

function weighingOp(id: string, userId = USER): OfflineOperation {
  const row = { id, bovino_id: 'bt-001', peso_kg: 488, fecha_pesaje: '2026-10-21' }
  return {
    id,
    userId,
    farmId: 'finca-norte',
    kind: 'weighing',
    payload: row,
    optimistic: row,
    state: 'pending',
    error: null,
    createdAt: '2026-10-21T12:00:00.000Z',
  }
}

describe('cola local Offline-First', () => {
  beforeEach(async () => {
    setOnline(false)
    setOfflineUser(null)
    await wipeOfflineDatabase()
  })

  it('CP-OFF-02 la cola sobrevive al cerrar la base y no la ve otro usuario', async () => {
    await enqueue(weighingOp('cap-1'))
    await writeCache(USER, 'weighings:finca-norte', 'finca-norte', [])
    await closeOfflineDatabase()

    expect(await operations(USER)).toHaveLength(1)
    expect(await operations(OTHER)).toHaveLength(0)
    expect(await readCache(OTHER, 'weighings:finca-norte')).toBeUndefined()
    expect(await readCache(USER, 'weighings:finca-norte')).toEqual([])
  })

  it('CP-PES-05 no admite dos veces el mismo identificador de captura', async () => {
    await enqueue(weighingOp('cap-1'))
    await expect(enqueue(weighingOp('cap-1'))).rejects.toThrow()
    expect(await operations(USER)).toHaveLength(1)
  })

  it('CP-AUTH-07 cambiar de sesión no borra las capturas del usuario anterior', async () => {
    await enqueue(weighingOp('cap-1'))
    setOfflineUser(OTHER)
    expect(await operations(USER)).toHaveLength(1)
    expect(await operations(OTHER)).toHaveLength(0)
  })

  it('CP-OFF-04 una confirmación aplica el pesaje una sola vez y lo retira de la cola', async () => {
    const op = weighingOp('cap-1')
    await enqueue(op)
    await writeCache(USER, 'weighings:finca-norte', 'finca-norte', [])
    const confirmed = { ...op.optimistic as object, peso_kg: 488 }

    await acknowledge(op, confirmed)
    await acknowledge(op, confirmed)

    const rows = await readCache<unknown[]>(USER, 'weighings:finca-norte')
    expect(rows).toHaveLength(1)
    expect(await operations(USER)).toHaveLength(0)
  })

  it('CP-OFF-08 sin sesión previa no hay usuario local para capturar', () => {
    expect(() => offlineUser()).toThrow(/Inicia sesión/)
  })
})
