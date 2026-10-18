import { supabase } from './supabase.ts'
import { requireConnection } from '../offline/runtime.ts'

export type DisposalRecord = {
  id: string
  bovino_id: string
  fecha_baja: string
  causa: string
  registrado_por: string | null
}

export type DisposalLoss = {
  perdida_economica: number | null
  costo_compra_calculado: number | null
  mantenimiento_diario: number | null
  mantenimiento_acumulado: number | null
  calculado_por: string | null
  calculado_en: string | null
}

// RF-UC13-01: consulta el evento operativo sin solicitar ni almacenar costos del toro.
export async function loadDisposals(bovineId: string): Promise<DisposalRecord[]> {
  requireConnection()
  const { data, error } = await supabase.rpc('obtener_bajas_bovino', { p_bovino_id: bovineId })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('El servidor devolvió bajas inválidas.')
  return data.map((row: DisposalRecord) => {
    if (typeof row.id !== 'string' || row.bovino_id !== bovineId ||
        typeof row.fecha_baja !== 'string' || typeof row.causa !== 'string') {
      throw new Error('El servidor devolvió una baja inválida.')
    }
    return row
  })
}

// RF-UC13-01: registra la baja y su estado en una transacción online; no devuelve importes.
export async function registerDisposal(bovineId: string, date: string, cause: string, maintenance: number | null) {
  requireConnection()
  const { data, error } = await supabase.rpc('registrar_baja', {
    p_bovino_id: bovineId, p_fecha_baja: date, p_causa: cause.trim(), p_mantenimiento_diario: maintenance,
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('El servidor no confirmó la baja.')
  return data
}

// RF-UC13-01: consulta los snapshots financieros exclusivamente mediante la RPC administrativa.
export async function loadDisposalLoss(disposalId: string): Promise<DisposalLoss> {
  requireConnection()
  const { data, error } = await supabase.rpc('obtener_perdida_baja', { p_baja_id: disposalId })
  if (error) throw error
  if (!Array.isArray(data) || data.length !== 1) throw new Error('El servidor devolvió una pérdida inválida.')
  const row = data[0]
  const amount = (key: string) => {
    if (row[key] == null) return null
    const value = Number(row[key])
    if (!Number.isFinite(value) || value < 0) throw new Error('El servidor devolvió un importe inválido.')
    return value
  }
  return {
    perdida_economica: amount('perdida_economica'), costo_compra_calculado: amount('costo_compra_calculado'),
    mantenimiento_diario: amount('mantenimiento_diario'), mantenimiento_acumulado: amount('mantenimiento_acumulado'),
    calculado_por: row.calculado_por, calculado_en: row.calculado_en,
  }
}

// RF-UC13-01: permite al administrador completar una pérdida pendiente conservando la captura original.
export async function completeDisposalLoss(disposalId: string, maintenance: number) {
  requireConnection()
  const { error } = await supabase.rpc('completar_perdida_baja', {
    p_baja_id: disposalId, p_mantenimiento_diario: maintenance,
  })
  if (error) throw error
}
