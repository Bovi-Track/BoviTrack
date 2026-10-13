import { addDays, daysBetween, parseIsoDate, todayIso, toIsoDate } from './dates.ts'
import type { Bovine, Weighing } from '../types/dashboard.ts'

/** GMD esperada de engorde, en kg/día. */
export const EXPECTED_GMD_KG = 0.8
/** Por debajo de este GMD semanal se considera baja ganancia. */
export const LOW_GMD_KG = 0.5

export type BovineGmd = {
  lifetime: number | null
  weekly: number | null
  lastWeight: number | null
  lastDate: string | null
}

export type WeeklyReportBull = {
  bovine: Bovine
  lastWeight: number | null
  prevWeight: number | null
  weekDelta: number | null
  lifetimeGmd: number | null
  weeklyGmd: number | null
}

export type WeeklyReport = {
  thisSaturday: string
  prevSaturday: string
  totalWeight: number | null
  averageWeight: number | null
  totalWeightGained: number | null
  totalDailyGain: number | null
  averageDailyGain: number | null
  totalWeightChangePct: number | null
  averageWeightChangePct: number | null
  dailyGainChangePct: number | null
  herdTotal: number
  overExpectedGain: number
  overAverageWeight: number
  belowAverageWeight: number
  lowGain: number
  bulls: WeeklyReportBull[]
}

// Comprueba si una fecha de calendario corresponde a un sábado.
function isSaturday(iso: string) {
  return parseIsoDate(iso).getDay() === 6
}

// Encuentra el sábado de referencia sin superar la fecha recibida.
function lastSaturdayOnOrBefore(iso: string) {
  const date = parseIsoDate(iso)
  const back = date.getDay() === 6 ? 0 : (date.getDay() + 1) % 7
  date.setDate(date.getDate() - back)
  return toIsoDate(date)
}

// Ordena una copia de los pesajes por fecha, sin modificar el historial recibido.
function sortedWeighings(list: Weighing[]) {
  return [...list].sort((a, b) => a.fecha_pesaje.localeCompare(b.fecha_pesaje))
}

// Calcula kg/día entre dos pesajes o devuelve null si no hay días transcurridos.
function gmdFromPair(first: Weighing, last: Weighing) {
  const days = daysBetween(first.fecha_pesaje, last.fecha_pesaje)
  if (days <= 0) return null
  return (last.peso_kg - first.peso_kg) / days
}

// Selecciona los dos sábados disponibles o los últimos dos pesajes anteriores al corte.
function weeklyPair(list: Weighing[], endDate?: string) {
  const sorted = sortedWeighings(list)
  const cutoff = endDate ? weighingsOnOrBefore(sorted, endDate) : sorted
  const saturdays = saturdayWeighings(cutoff)
  const source = saturdays.length >= 2 ? saturdays : cutoff
  if (source.length < 2) return null
  return { first: source[source.length - 2], last: source[source.length - 1] }
}

// Filtra y ordena los pesajes que no superan la fecha de corte.
function weighingsOnOrBefore(list: Weighing[], date: string) {
  return list.filter((item) => item.fecha_pesaje <= date)
}

// Filtra los pesajes realizados un sábado conservando su orden.
function saturdayWeighings(list: Weighing[]) {
  return list.filter((item) => isSaturday(item.fecha_pesaje))
}

// RF-UC06-01: calcula GMD semanal con los dos sábados o los dos pesajes disponibles.
export function weeklyGmd(list: Weighing[], endDate?: string) {
  const pair = weeklyPair(list, endDate)
  if (!pair) return null
  return gmdFromPair(pair.first, pair.last)
}

// RF-UC06-01: calcula GMD entre el primer y el último pesaje válido.
export function lifetimeGmd(list: Weighing[]) {
  const sorted = sortedWeighings(list)
  if (sorted.length < 2) return null
  return gmdFromPair(sorted[0], sorted[sorted.length - 1])
}

// RF-UC06-01: reúne la GMD total/semanal y el último peso y fecha del toro.
export function bovineGmd(list: Weighing[]): BovineGmd {
  const sorted = sortedWeighings(list)
  const latest = sorted[sorted.length - 1]
  return {
    lifetime: lifetimeGmd(sorted),
    weekly: weeklyGmd(sorted),
    lastWeight: latest?.peso_kg ?? null,
    lastDate: latest?.fecha_pesaje ?? null,
  }
}

// Calcula el promedio de valores disponibles; devuelve null para una lista vacía.
function mean(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

// Compara dos valores en porcentaje y evita dividir por cero o datos ausentes.
function pctChange(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

// Agrupa y ordena el historial de pesajes de cada toro.
function weighingsByBovine(weighings: Weighing[]) {
  const map = new Map<string, Weighing[]>()
  for (const weigh of weighings) {
    const list = map.get(weigh.bovino_id) ?? []
    list.push(weigh)
    map.set(weigh.bovino_id, list)
  }
  for (const [id, list] of map) {
    map.set(id, sortedWeighings(list))
  }
  return map
}

// Obtiene el último peso disponible hasta una fecha de corte.
function lastWeightOnOrBefore(list: Weighing[], date: string) {
  const match = [...list].reverse().find((item) => item.fecha_pesaje <= date)
  return match?.peso_kg ?? null
}

// Reúne los pesos conocidos del hato activo para una fecha de comparación.
function snapshotOnOrBefore(
  active: Bovine[],
  byBovine: Map<string, Weighing[]>,
  date: string,
) {
  const weights: number[] = []
  for (const bovine of active) {
    const weight = lastWeightOnOrBefore(byBovine.get(bovine.id) ?? [], date)
    if (weight != null) weights.push(weight)
  }
  return weights
}

// Reúne el último peso disponible de cada toro activo.
function latestWeights(active: Bovine[], byBovine: Map<string, Weighing[]>) {
  const weights: number[] = []
  for (const bovine of active) {
    const list = byBovine.get(bovine.id) ?? []
    const latest = list[list.length - 1]
    if (latest) weights.push(latest.peso_kg)
  }
  return weights
}

// Calcula las GMD semanales disponibles del hato hasta una fecha de corte.
function weeklyGmdsAt(
  active: Bovine[],
  byBovine: Map<string, Weighing[]>,
  endDate: string,
) {
  const values: number[] = []
  for (const bovine of active) {
    const value = weeklyGmd(byBovine.get(bovine.id) ?? [], endDate)
    if (value != null) values.push(value)
  }
  return values
}

// Elige los sábados de referencia a partir del historial o la fecha local actual.
function referenceSaturdays(weighings: Weighing[]) {
  const saturdays = [
    ...new Set(
      weighings
        .map((item) => item.fecha_pesaje)
        .filter((date) => isSaturday(date)),
    ),
  ].sort()
  const thisSaturday =
    saturdays.at(-1) ?? lastSaturdayOnOrBefore(todayIso())
  const prevSaturday =
    saturdays.length >= 2 ? saturdays[saturdays.length - 2] : addDays(thisSaturday, -7)
  return { thisSaturday, prevSaturday }
}

// RF-UC06-01 y RF-TR-03 (parcial): construye los datos del reporte semanal del hato.
export function buildWeeklyReport(
  bovines: Bovine[],
  weighings: Weighing[],
): WeeklyReport {
  const active = bovines.filter((item) => item.estado === 'ACTIVO')
  const byBovine = weighingsByBovine(weighings)
  const { thisSaturday, prevSaturday } = referenceSaturdays(weighings)

  const currentWeights = latestWeights(active, byBovine)
  const latestDate = weighings
    .map((item) => item.fecha_pesaje)
    .sort()
    .at(-1)
  const compareFrom = latestDate ? addDays(latestDate, -7) : prevSaturday
  const prevWeekWeights = snapshotOnOrBefore(active, byBovine, compareFrom)

  const thisGmds: number[] = []
  for (const bovine of active) {
    const value = weeklyGmd(byBovine.get(bovine.id) ?? [])
    if (value != null) thisGmds.push(value)
  }
  const prevGmds = weeklyGmdsAt(active, byBovine, compareFrom)

  const totalWeight = currentWeights.length > 0 ? currentWeights.reduce((a, b) => a + b, 0) : null
  const averageWeight = mean(currentWeights)
  const prevTotal =
    prevWeekWeights.length > 0 ? prevWeekWeights.reduce((a, b) => a + b, 0) : null
  const prevAverage = mean(prevWeekWeights)

  const averageDailyGain = mean(thisGmds)
  const totalDailyGain =
    thisGmds.length > 0 ? thisGmds.reduce((a, b) => a + b, 0) : null
  const prevAverageDaily = mean(prevGmds)

  const bulls: WeeklyReportBull[] = active
    .map((bovine) => {
      const list = byBovine.get(bovine.id) ?? []
      const gmd = bovineGmd(list)
      const pair = weeklyPair(list)
      const prevWeight =
        pair?.first.peso_kg ?? lastWeightOnOrBefore(list, prevSaturday)
      const lastWeight = gmd.lastWeight
      const weekDelta =
        lastWeight != null && prevWeight != null ? lastWeight - prevWeight : null
      return {
        bovine,
        lastWeight,
        prevWeight,
        weekDelta,
        lifetimeGmd: gmd.lifetime,
        weeklyGmd: gmd.weekly,
      }
    })
    .sort((a, b) =>
      a.bovine.identificador_interno.localeCompare(
        b.bovine.identificador_interno,
        'es',
      ),
    )

  const weekDeltas = bulls
    .map((item) => item.weekDelta)
    .filter((value): value is number => value != null)
  const totalWeightGained =
    weekDeltas.length > 0 ? weekDeltas.reduce((sum, value) => sum + value, 0) : null

  const overAverageWeight = bulls.filter(
    (item) =>
      item.lastWeight != null &&
      averageWeight != null &&
      item.lastWeight > averageWeight,
  ).length
  const belowAverageWeight = bulls.filter(
    (item) =>
      item.lastWeight != null &&
      averageWeight != null &&
      item.lastWeight < averageWeight,
  ).length

  return {
    thisSaturday,
    prevSaturday,
    totalWeight,
    averageWeight,
    totalWeightGained,
    totalDailyGain,
    averageDailyGain,
    totalWeightChangePct: pctChange(totalWeight, prevTotal),
    averageWeightChangePct: pctChange(averageWeight, prevAverage),
    dailyGainChangePct: pctChange(averageDailyGain, prevAverageDaily),
    herdTotal: active.length,
    overExpectedGain: thisGmds.filter((value) => value >= EXPECTED_GMD_KG).length,
    overAverageWeight,
    belowAverageWeight,
    lowGain: thisGmds.filter((value) => value < LOW_GMD_KG).length,
    bulls,
  }
}

// Formatea un peso con decimales y unidad, o un indicador de dato ausente.
export function formatKg(value: number | null, digits = 2) {
  if (value == null) return '—'
  return `${value.toFixed(digits)} kg`
}

// Formatea una variación numérica mostrando el signo positivo cuando corresponde.
export function formatSigned(value: number | null, digits = 1) {
  if (value == null) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(digits)}`
}

// Prepara el texto y sentido de una variación porcentual para la interfaz y el PDF.
export function formatPct(value: number | null) {
  if (value == null) return null
  const rounded = Math.round(value)
  return {
    text: `${rounded > 0 ? '+' : ''}${rounded}%`,
    up: rounded >= 0,
  }
}
