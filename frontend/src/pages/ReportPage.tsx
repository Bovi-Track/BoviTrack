import { useOfflineRevision } from '../offline/useOfflineRevision.ts'
import { FileText, Save } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Toast } from '../components/dashboard/Toast.tsx'
import { WeeklyReportCard } from '../components/dashboard/WeeklyReportCard.tsx'
import { useFarm } from '../context/useFarm.ts'
import { useAuth } from '../auth/useAuth.ts'
import { Field, fieldClass } from '../components/dashboard/Modal.tsx'
import { loadInventoryReport, validateInventoryPeriod } from '../lib/inventory.ts'
import { loadBovines } from '../lib/bovines.ts'
import { loadSanitaryRecords, loadTreatments } from '../lib/sanitary.ts'
import { loadWeighings } from '../lib/weighings.ts'
import { isValidIsoDate, todayIso } from '../lib/dates.ts'
import { buildWeeklyReport } from '../lib/gmd.ts'
import { loadSales } from '../lib/sales.ts'
import {
  REPORT_SECTIONS,
  buildReportPdf,
  defaultReportSelection,
  isAbortError,
  saveReportPdf,
  selectedSectionCount,
  suggestedReportFilename,
  type ReportData,
  type ReportSelection,
} from '../lib/report.ts'
import type { Bovine, Farm, SaleRecord, Treatment, Weighing } from '../types/dashboard.ts'
import type { SanitaryRecord } from '../types/sanitary.ts'

// RF-TR-03: presenta los reportes de la finca y exige administración para generar PDF.
export default function ReportPage() {
  const { activeFarm, rolesByFarm, loading, loadedUserId } = useFarm()
  const { user, loading: authLoading } = useAuth()
  if (loading || authLoading) return <p className="px-4 pt-10 text-sm text-stone-500">Cargando…</p>
  if (user && loadedUserId !== user.id) return <p role="alert" className="px-4 pt-10 text-sm text-red-700">No se pudo verificar tu acceso a las fincas. <button type="button" className="underline" onClick={() => window.location.reload()}>Reintentar</button></p>
  if (!activeFarm || rolesByFarm[activeFarm.id] !== 'admin') return <p role="alert" className="p-6">Los reportes requieren el rol ADMINISTRADOR en la finca seleccionada.</p>
  return <FarmReport key={`${user?.id ?? ''}:${activeFarm?.id ?? ''}`} activeFarm={activeFarm}
    canInventory={Boolean(user && activeFarm && rolesByFarm[activeFarm.id] === 'admin')} />
}

// RF-TR-03: coordina selección, periodo inclusivo de secciones y descarga autorizada.
function FarmReport({ activeFarm, canInventory }: { activeFarm: Farm | null; canInventory: boolean }) {
  const revision = useOfflineRevision()
  const [selection, setSelection] = useState<ReportSelection>(defaultReportSelection)
  const [desde, setDesde] = useState(() => `${todayIso().slice(0, 7)}-01`)
  const [hasta, setHasta] = useState(todayIso)
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [weighings, setWeighings] = useState<Weighing[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [sanitaryRecords, setSanitaryRecords] = useState<SanitaryRecord[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loadingData, setLoadingData] = useState(Boolean(activeFarm))
  const [dataError, setDataError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    tone: 'ok' | 'warn' | 'error'
  } | null>(null)
  const live = useRef(false)
  const generating = useRef(false)
  const farmId = activeFarm?.id

  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!farmId) return
    const capturedFarmId = farmId
    let active = true
    // Carga datos de finca y los historiales necesarios para el reporte por periodo.
    async function load() {
      try {
        const nextBovines = await loadBovines(capturedFarmId)
        const ids = nextBovines.map((item) => item.id)
        const [nextWeighings, nextTreatments, nextSanitaryRecords, nextSales] = await Promise.all([
          loadWeighings(ids, capturedFarmId),
          loadTreatments(ids, capturedFarmId),
          loadSanitaryRecords(capturedFarmId),
          loadSales(capturedFarmId),
        ])
        if (!active) return
        setBovines(nextBovines)
        setWeighings(nextWeighings)
        setTreatments(nextTreatments)
        setSanitaryRecords(nextSanitaryRecords)
        setSales(nextSales)
        setDataError(false)
      } catch {
        if (active) {
          setDataError(true)
          setToast({
            message: 'No se pudieron cargar los datos del reporte.',
            tone: 'error',
          })
        }
      } finally {
        if (active) setLoadingData(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [farmId, revision])

  const effectiveSelection = { ...selection, inventario: canInventory && selection.inventario }
  const selectedCount = selectedSectionCount(effectiveSelection)

  const reportData = useMemo<ReportData | null>(() => {
    if (!activeFarm) return null
    return {
      farmName: activeFarm.nombre,
      farmLocation: activeFarm.ubicacion,
      generatedAt: new Date().toISOString(),
      bovines,
      weighings,
      treatments,
      sanitaryRecords,
      sales,
    }
  }, [activeFarm, bovines, sales, sanitaryRecords, treatments, weighings])

  // Activa o desactiva una sección de la selección del reporte.
  function toggle(id: keyof ReportSelection) {
    setSelection((current) => ({ ...current, [id]: !current[id] }))
  }

  // RF-TR-03: filtra historiales al periodo y genera el PDF con autorización vigente.
  async function generate() {
    if (generating.current) return
    if (!reportData) {
      setToast({ message: 'Selecciona una finca activa desde Inicio.', tone: 'warn' })
      return
    }
    if (selectedCount === 0) {
      setToast({
        message: 'Elige al menos una sección para incluir en el PDF.',
        tone: 'warn',
      })
      return
    }
    const capturedSelection = { ...effectiveSelection }
    const capturedFarmId = activeFarm?.id
    const usesPeriod = capturedSelection.semanal || capturedSelection.pesajes || capturedSelection.tratamientos || capturedSelection.venta || capturedSelection.inventario
    generating.current = true
    setSaving(true)
    try {
      if (usesPeriod && (!isValidIsoDate(desde) || !isValidIsoDate(hasta) || desde > hasta)) {
        throw new Error('Selecciona un periodo válido: la fecha inicial debe ser anterior o igual a la final.')
      }
      if (capturedSelection.inventario) validateInventoryPeriod(desde, hasta)
      const inventory = capturedSelection.inventario && capturedFarmId
        ? await loadInventoryReport(capturedFarmId, desde, hasta) : undefined
      if (!live.current) return
      const inPeriod = (date: string) => !usesPeriod || (date >= desde && date <= hasta)
      const currentData = {
        ...reportData,
        generatedAt: new Date().toISOString(),
        inventory,
        period: usesPeriod ? { desde, hasta } : undefined,
        weighings: reportData.weighings.filter((item) => inPeriod(item.fecha_pesaje)),
        sanitaryRecords: (reportData.sanitaryRecords ?? []).filter((item) => inPeriod(item.fecha)),
        sales: (reportData.sales ?? []).filter((item) => inPeriod(item.fecha_venta)),
      }
      const blob = buildReportPdf(currentData, capturedSelection)
      const filename = suggestedReportFilename(
        reportData.farmName,
        currentData.generatedAt,
      )
      await saveReportPdf(blob, filename, activeFarm!.id, () => live.current)
      if (!live.current) return
      setToast({
        message: 'Elige la carpeta y guarda el PDF.',
        tone: 'ok',
      })
    } catch (cause) {
      if (!live.current) return
      if (isAbortError(cause)) return
      setToast({
        message:
          cause instanceof Error
            ? cause.message
            : 'No se pudo guardar el PDF.',
        tone: 'error',
      })
    } finally {
      generating.current = false
      if (live.current) setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <header className="mb-5">
        <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
          DOCUMENTOS
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
          Reporte semanal
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {activeFarm
            ? `GMD y estructura del hato de ${activeFarm.nombre}. También puedes generar el PDF.`
            : 'Selecciona una finca desde Inicio para ver el reporte.'}
        </p>
      </header>

      {activeFarm && reportData ? (
        <div className="mb-5">
          <WeeklyReportCard
            farmName={activeFarm.nombre}
            report={buildWeeklyReport(bovines, weighings)}
          />
        </div>
      ) : null}

      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold text-stone-900">
            Secciones del reporte
          </h2>
          <span className="rounded-full bg-bovi/10 px-3 py-1 text-xs font-semibold text-bovi">
            {selectedCount} seleccionadas
          </span>
        </div>

        <ul className="space-y-2">
          {REPORT_SECTIONS.map((section) => {
            const checked = effectiveSelection[section.id]
            return (
              <li key={section.id}>
                <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl bg-cream px-3 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving || (section.id === 'inventario' && !canInventory)}
                    onChange={() => toggle(section.id)}
                    className="mt-1 size-5 accent-bovi"
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-900">
                      {section.label}
                    </span>
                    <span className="text-xs text-stone-500">
                      {section.id === 'inventario' && !canInventory ? 'Disponible para administradores de la finca.' : section.description}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {effectiveSelection.semanal || effectiveSelection.pesajes || effectiveSelection.tratamientos || effectiveSelection.venta || effectiveSelection.inventario ? <div className="mt-4 space-y-3 rounded-2xl bg-cream p-4">
          <p className="text-sm font-medium text-stone-800">Periodo del reporte</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="report-desde" label="Desde"><input id="report-desde" type="date" required disabled={saving} value={desde} onChange={(e) => setDesde(e.target.value)} className={fieldClass} /></Field>
            <Field id="report-hasta" label="Hasta"><input id="report-hasta" type="date" required disabled={saving} value={hasta} onChange={(e) => setHasta(e.target.value)} className={fieldClass} /></Field>
          </div>
          <p className="text-xs text-stone-500">Ambas fechas se incluyen en pesajes/GMD, ventas y sanidad. El inventario de bodega también consulta este periodo.</p>
        </div> : null}

        <button
          type="button"
          onClick={generate}
          disabled={!activeFarm || loadingData || dataError || saving || selectedCount === 0}
          className="mt-5 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-bovi text-sm font-semibold text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {loadingData ? 'Cargando datos…' : saving ? 'Guardando…' : 'Guardar PDF'}
        </button>
        {dataError ? <p role="alert" className="mt-3 text-center text-sm text-red-700">No se descargará un reporte incompleto. Actualiza la página e inténtalo de nuevo.</p> : null}
        <p className="mt-3 text-center text-xs text-stone-400">
          Elige la carpeta y el nombre del archivo.
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-bovi">
          <FileText className="size-4" />
          <h2 className="font-serif text-lg font-semibold text-stone-900">
            Contenido que se incluirá
          </h2>
        </div>
        {selectedCount === 0 ? (
          <p className="text-sm text-stone-400">
            Marca al menos una sección para armar el documento.
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-stone-600">
            {REPORT_SECTIONS.filter((section) => effectiveSelection[section.id]).map(
              (section) => (
                <li key={section.id} className="rounded-xl bg-cream px-3 py-2">
                  {section.label}
                </li>
              ),
            )}
          </ul>
        )}
        {!activeFarm ? (
          <Link
            to="/inicio"
            className="mt-4 inline-flex text-sm font-medium text-bovi underline underline-offset-2"
          >
            Ir a Inicio para elegir finca
          </Link>
        ) : null}
      </section>
    </div>
  )
}
