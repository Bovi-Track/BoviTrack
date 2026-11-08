import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncPending, setOfflineUser } from '../offline/runtime.ts'
import { enqueue, operations, readCache, writeCache } from '../offline/store.ts'
import type { OfflineOperation } from '../offline/types.ts'
import { supabase } from '../lib/supabase.ts'
import { wipeOfflineDatabase } from './offline-db.ts'
import { setOnline } from './network.ts'

vi.mock('../lib/supabase.ts', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    rpc: vi.fn(),
  },
  setRememberMe: vi.fn(),
}))

const USER = 'campo-norte'

function chain(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  return {
    setHeader: () => ({ abortSignal: () => Promise.resolve(result) }),
    abortSignal: () => Promise.resolve(result),
  }
}

function weighing(id: string): OfflineOperation {
  const row = { id, bovino_id: 'bt-001', peso_kg: 489, fecha_pesaje: '2026-10-22' }
  return {
    id, userId: USER, farmId: 'finca-norte', kind: 'weighing',
    payload: row, optimistic: row, state: 'pending', error: null,
    createdAt: '2026-10-22T12:00:00.000Z',
  }
}

describe('sincronización diferida', () => {
  beforeEach(async () => {
    vi.mocked(supabase.rpc).mockReset()
    vi.mocked(supabase.auth.getSession).mockReset()
    setOnline(true)
    setOfflineUser(null)
    await wipeOfflineDatabase()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: USER }, access_token: 'token-prueba' } },
      error: null,
    } as never)
  })

  it('CP-OFF-03 al reconectar envía la captura una sola vez', async () => {
    vi.mocked(supabase.rpc).mockImplementation(() => chain({
      data: { id: 'cap-sync', bovino_id: 'bt-001', peso_kg: 489, fecha_pesaje: '2026-10-22' },
      error: null,
    }) as never)
    await writeCache(USER, 'weighings:finca-norte', 'finca-norte', [])
    await enqueue(weighing('cap-sync'))
    setOfflineUser(USER)

    await vi.waitFor(async () => {
      expect(await operations(USER)).toHaveLength(0)
    })
    const calls = vi.mocked(supabase.rpc).mock.calls.length
    await syncPending()

    expect(vi.mocked(supabase.rpc).mock.calls.length).toBe(calls)
    expect(await readCache<unknown[]>(USER, 'weighings:finca-norte')).toHaveLength(1)
  })

  it('CP-OFF-04 un rechazo se conserva con el motivo y no se reintenta en silencio', async () => {
    vi.mocked(supabase.rpc).mockImplementation(() => chain({
      data: null,
      error: { code: 'P0001', message: 'El toro ya fue vendido' },
    }) as never)
    await enqueue(weighing('cap-rechazo'))
    setOfflineUser(USER)

    await vi.waitFor(async () => {
      const [pending] = await operations(USER)
      expect(pending?.state).toBe('rejected')
      expect(pending?.error).toMatch(/vendido/)
    })
    const calls = vi.mocked(supabase.rpc).mock.calls.length
    await syncPending()
    expect(vi.mocked(supabase.rpc).mock.calls.length).toBe(calls)
  })

  it('CP-OFF-05 una sesión distinta no sincroniza y conserva la cola', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'otra-cuenta' }, access_token: 'otro' } },
      error: null,
    } as never)
    await enqueue(weighing('cap-sesion'))
    setOfflineUser(USER)
    const reauth = vi.fn()
    window.addEventListener('bovitrack:reauth', reauth)

    await vi.waitFor(() => {
      expect(reauth).toHaveBeenCalled()
    })
    expect(await operations(USER)).toHaveLength(1)
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalled()
    window.removeEventListener('bovitrack:reauth', reauth)
  })
})
