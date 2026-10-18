import { bovineGmd } from './gmd.ts'
import { addDays, daysBetween, isValidIsoDate, todayIso } from './dates.ts'
import type { Bovine, BovineAcquisitionCost, DashboardMetrics, SaleHint, Treatment, Weighing } from '../types/dashboard.ts'

export const SALE_REQUIRED_WEIGHINGS = 8
export const SALE_WEIGHING_WINDOW_DAYS = 56

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

// RF-UC10-01: normaliza pesajes positivos por fecha distinta dentro de los 56 días, hoy incluido.
function recentSaleWeighings(weighings: Weighing[], referenceDate: string) {
  const firstDate = addDays(referenceDate, 1 - SALE_WEIGHING_WINDOW_DAYS)
  const byDate = new Map<string, Weighing>()
  const sorted = [...weighings]
    .filter((weigh) => Number.isFinite(weigh.peso_kg) && weigh.peso_kg > 0)
    .filter((weigh) => isValidIsoDate(weigh.fecha_pesaje))
    .filter((weigh) => weigh.fecha_pesaje >= firstDate && weigh.fecha_pesaje <= referenceDate)
    .sort((a, b) => a.fecha_pesaje.localeCompare(b.fecha_pesaje) ||
      (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
  for (const weigh of sorted) byDate.set(weigh.fecha_pesaje, weigh)
  return [...byDate.values()]
}

// RF-UC10-01: cuenta las fechas distintas que habilitan una evaluación de venta.
export function saleWeighingCount(weighings: Weighing[], referenceDate = todayIso()) {
  return recentSaleWeighings(weighings, referenceDate).length
}

export type SaleEvaluationInputs = {
  expectedPricePerKg: number | null
  maintenancePerDay: number | null
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// RF-UC10-01/02: calcula el punto de equilibrio actual sin proyectar pesos o precios futuros.
export function saleHints(
  bovines: Bovine[],
  weighings: Weighing[],
  acquisitionCosts: BovineAcquisitionCost[] = [],
  inputs: SaleEvaluationInputs = { expectedPricePerKg: null, maintenancePerDay: null },
  referenceDate = todayIso(),
): SaleHint[] {
  const byBovine = new Map<string, Weighing[]>()
  for (const weigh of weighings) {
    const list = byBovine.get(weigh.bovino_id) ?? []
    list.push(weigh)
    byBovine.set(weigh.bovino_id, list)
  }

  return bovines
    .filter((item) => item.estado === 'ACTIVO')
    .map((bovine) => {
      const list = recentSaleWeighings(byBovine.get(bovine.id) ?? [], referenceDate)
      const count = list.length
      if (count < SALE_REQUIRED_WEIGHINGS) {
        return {
          bovine,
          status: 'falta_pesajes' as const,
          detail: `${count}/${SALE_REQUIRED_WEIGHINGS} pesajes válidos en los últimos ${SALE_WEIGHING_WINDOW_DAYS} días`,
          weighings: count,
        }
      }
      if (inputs.expectedPricePerKg == null || inputs.expectedPricePerKg <= 0 ||
          inputs.maintenancePerDay == null || inputs.maintenancePerDay < 0) {
        return {
          bovine, status: 'falta_parametros' as const,
          detail: 'Ingresa precio esperado por kg y mantenimiento diario por toro.', weighings: count,
        }
      }

      const cost = acquisitionCosts.find((item) => item.id === bovine.id)
      const initial = byBovine.get(bovine.id)?.find((weigh) => weigh.es_inicial)
      if (!cost?.compra_id || cost.precio_compra_kilo == null || !initial ||
          !Number.isFinite(initial.peso_kg) || initial.peso_kg <= 0 ||
          !Number.isFinite(cost.costo_flete_asignado) || cost.costo_flete_asignado < 0 ||
          !bovine.fecha_ingreso || !isValidIsoDate(bovine.fecha_ingreso) ||
          bovine.fecha_ingreso > referenceDate) {
        return {
          bovine, status: 'falta_costos' as const,
          detail: 'Falta costo de compra, pesaje inicial o fecha de ingreso para este toro.', weighings: count,
        }
      }

      const first = list[0]
      const last = list[list.length - 1]
      const daysBetweenWeights = daysBetween(first.fecha_pesaje, last.fecha_pesaje)
      const recentGmd = daysBetweenWeights > 0 ? (last.peso_kg - first.peso_kg) / daysBetweenWeights : null
      const currentWeight = last.peso_kg
      const acquisitionCost = roundMoney(initial.peso_kg * cost.precio_compra_kilo + cost.costo_flete_asignado)
      const maintenanceCost = roundMoney(inputs.maintenancePerDay * daysBetween(bovine.fecha_ingreso, referenceDate))
      const accumulatedCost = roundMoney(acquisitionCost + maintenanceCost)
      const expectedRevenue = roundMoney(currentWeight * inputs.expectedPricePerKg)
      const margin = roundMoney(expectedRevenue - accumulatedCost)
      const breakEvenPrice = accumulatedCost / currentWeight

      return {
        bovine,
        status: margin >= 0 ? 'rentable' as const : 'no_rentable' as const,
        detail: margin >= 0 ? 'El precio esperado alcanza el punto de equilibrio.' : 'El precio esperado no alcanza el punto de equilibrio.',
        weighings: count,
        currentWeight,
        recentGmd,
        acquisitionCost,
        maintenanceCost,
        accumulatedCost,
        expectedRevenue,
        margin,
        breakEvenPrice,
      }
    })
}
