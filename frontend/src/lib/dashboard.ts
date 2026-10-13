import { bovineGmd } from './gmd.ts'
import { todayIso } from './dates.ts'
import type { Bovine, DashboardMetrics, SaleHint, Treatment, Weighing } from '../types/dashboard.ts'

// Construye el saludo según la hora local y el nombre del usuario.
export function greetingForNow(name: string) {
  const hour = new Date().getHours()
  const hello =
    hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  return `${hello}, ${name}`
}

// RF-UC06-01 y RF-UC07-02: agrega GMD del hato activo y cuenta alertas sanitarias.
export function computeMetrics(
  bovines: Bovine[],
  weighings: Weighing[],
  treatments: Treatment[],
): DashboardMetrics {
  const active = bovines.filter((item) => item.estado === 'ACTIVO')
  const byBovine = new Map<string, Weighing[]>()
  for (const weigh of weighings) {
    const list = byBovine.get(weigh.bovino_id) ?? []
    list.push(weigh)
    byBovine.set(weigh.bovino_id, list)
  }

  const gmds: number[] = []
  const weeklyGmds: number[] = []
  for (const bovine of active) {
    const gmd = bovineGmd(byBovine.get(bovine.id) ?? [])
    if (gmd.lifetime != null) gmds.push(gmd.lifetime)
    if (gmd.weekly != null) weeklyGmds.push(gmd.weekly)
  }

  const today = todayIso()
  const pendingAlerts = treatments.filter((item) => {
    if (!item.proxima_aplicacion) return false
    return item.proxima_aplicacion <= today
  }).length

  return {
    activeBulls: active.length,
    averageGmd:
      gmds.length > 0
        ? gmds.reduce((sum, value) => sum + value, 0) / gmds.length
        : null,
    weeklyGmd:
      weeklyGmds.length > 0
        ? weeklyGmds.reduce((sum, value) => sum + value, 0) / weeklyGmds.length
        : null,
    pendingAlerts,
  }
}

// RF-UC10-02 y RF-UC10-03 (parcial): genera la sugerencia heredada por peso y GMD.
// Todavía no aplica los mínimos de RF-UC10-01 ni la evaluación económica completa.
export function saleHints(bovines: Bovine[], weighings: Weighing[]): SaleHint[] {
  const byBovine = new Map<string, Weighing[]>()
  for (const weigh of weighings) {
    const list = byBovine.get(weigh.bovino_id) ?? []
    list.push(weigh)
    byBovine.set(weigh.bovino_id, list)
  }

  return bovines
    .filter((item) => item.estado === 'ACTIVO')
    .slice(0, 6)
    .map((bovine) => {
      const list = byBovine.get(bovine.id) ?? []
      if (list.length < 2) {
        return {
          bovine,
          status: 'falta' as const,
          detail: 'Faltan pesajes para evaluar',
        }
      }
      const first = list[0]
      const last = list[list.length - 1]
      const days =
        (new Date(last.fecha_pesaje).getTime() -
          new Date(first.fecha_pesaje).getTime()) /
        86_400_000
      const gmd = days > 0 ? (last.peso_kg - first.peso_kg) / days : 0
      if (last.peso_kg >= 420 && gmd >= 0.8) {
        return {
          bovine,
          status: 'apto' as const,
          detail: `${last.peso_kg.toFixed(0)} kg · GMD ${gmd.toFixed(2)}`,
        }
      }
      return {
        bovine,
        status: 'mantener' as const,
        detail: `${last.peso_kg.toFixed(0)} kg · seguir engorde`,
      }
    })
}
