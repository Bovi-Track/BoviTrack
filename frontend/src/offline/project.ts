import type { CachedData, OfflineOperation } from './types.ts'

type Row = Record<string, unknown>

// Superpone una captura o confirmación sobre la copia consultada, sin modificar el original.
export function projectOperation(entry: CachedData, op: OfflineOperation, result: unknown): unknown {
  if (entry.farm_id !== op.farmId) return entry.value
  const value = result as Row
  const pending = result === op.optimistic
  if (Array.isArray(entry.value)) {
    const rows = entry.value as Row[]
    if (op.kind === 'weighing' && entry.key.startsWith('weighings:')) {
      const ids = entry.key.slice('weighings:'.length).split(',')
      if (ids.includes(String(value.bovino_id))) return [...rows.filter((r) => r.id !== value.id), value]
        .sort((a, b) => String(a.fecha_pesaje).localeCompare(String(b.fecha_pesaje)))
    }
    if (op.kind === 'sanitary' && entry.key.startsWith('sanitary:')) {
      return [...rows.filter((r) => r.id !== value.id), value]
    }
    if (op.kind === 'sanitary' && entry.key.startsWith('treatments:') && value.proxima) {
      return [...rows.filter((r) => r.id !== value.id), {
        id: value.id, bovino_id: value.bovino_id, proxima_aplicacion: value.proxima,
        observaciones: value.observaciones,
      }]
    }
    if (op.kind === 'task' && entry.key.startsWith('tasks:')) {
      return rows.map((r) => r.id === op.payload.id ? { ...r, estado: op.payload.estado } : r)
    }
    if (op.kind === 'inventory' && entry.key.startsWith('inventory:')) {
      const delta = ['ENTRADA', 'AJUSTE_POSITIVO'].includes(String(op.payload.tipo))
        ? Number(op.payload.cantidad) : -Number(op.payload.cantidad)
      return rows.map((r) => r.id === op.payload.insumo_id ? {
        ...r, stock: pending ? (Math.round(Number(r.stock) * 100) + Math.round(delta * 100)) / 100 : Number(value.stock),
      } : r)
    }
  }
  if (op.kind === 'inventory' && entry.key === `history:${op.payload.insumo_id}:0`) {
    const page = entry.value as { movimientos: Row[]; total: number }
    const movement = value.movimiento as Row
    if (!page.movimientos.some((r) => r.id === movement.id)) {
      return { movimientos: [movement, ...page.movimientos], total: page.total + 1 }
    }
  }
  return entry.value
}
