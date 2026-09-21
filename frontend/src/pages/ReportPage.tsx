import { FileText, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import {
  loadBovines,
  loadTreatments,
  loadWeighings,
} from '../lib/dashboard.ts'
import {
  REPORT_SECTIONS,
  buildReportHtml,
  defaultReportSelection,
  openReportPrintWindow,
  selectedSectionCount,
  type ReportData,
  type ReportSelection,
} from '../lib/report.ts'
import type { Bovine, Treatment, Weighing } from '../types/dashboard.ts'

export default function ReportPage() {
  const { activeFarm, loading } = useFarm()
  const [selection, setSelection] = useState<ReportSelection>(defaultReportSelection)
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [weighings, setWeighings] = useState<Weighing[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    tone: 'ok' | 'warn' | 'error'
  } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!activeFarm) {
      setBovines([])
      setWeighings([])
      setTreatments([])
      return
    }
    const farmId = activeFarm.id
    let active = true
    setLoadingData(true)
    async function load() {
      try {
        const nextBovines = await loadBovines(farmId)
        const ids = nextBovines.map((item) => item.id)
        const [nextWeighings, nextTreatments] = await Promise.all([
          loadWeighings(ids),
          loadTreatments(ids),
        ])
        if (!active) return
        setBovines(nextBovines)
        setWeighings(nextWeighings)
        setTreatments(nextTreatments)
      } catch {
        if (active) {
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
  }, [activeFarm])

  const selectedCount = selectedSectionCount(selection)

  const reportData = useMemo<ReportData | null>(() => {
    if (!activeFarm) return null
    return {
      farmName: activeFarm.nombre,
      farmLocation: activeFarm.ubicacion,
      generatedAt: new Date().toISOString(),
      bovines,
      weighings,
      treatments,
    }
  }, [activeFarm, bovines, treatments, weighings])

  function toggle(id: keyof ReportSelection) {
    setSelection((current) => ({ ...current, [id]: !current[id] }))
  }

  function generate() {
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
    try {
      openReportPrintWindow(buildReportHtml(reportData, selection))
      setToast({
        message: 'En el diálogo de impresión elige Guardar como PDF.',
        tone: 'ok',
      })
    } catch (cause) {
      setToast({
        message:
          cause instanceof Error
            ? cause.message
            : 'No se pudo abrir el reporte.',
        tone: 'error',
      })
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 pt-10 text-sm text-stone-500">Cargando…</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <header className="mb-5">
        <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
          DOCUMENTOS
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
          Generar reporte PDF
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {activeFarm
            ? `Elige qué incluir del reporte de ${activeFarm.nombre}.`
            : 'Selecciona una finca desde Inicio para generar el reporte.'}
        </p>
      </header>

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
            const checked = selection[section.id]
            return (
              <li key={section.id}>
                <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl bg-cream px-3 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(section.id)}
                    className="mt-1 size-5 accent-bovi"
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-900">
                      {section.label}
                    </span>
                    <span className="text-xs text-stone-500">
                      {section.description}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={generate}
          disabled={!activeFarm || loadingData || selectedCount === 0}
          className="mt-5 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-bovi text-sm font-semibold text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Printer className="size-4" />
          {loadingData ? 'Cargando datos…' : 'Generar PDF'}
        </button>
        <p className="mt-3 text-center text-xs text-stone-400">
          Se abre el diálogo de impresión. Selecciona Guardar como PDF para descargarlo.
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
            {REPORT_SECTIONS.filter((section) => selection[section.id]).map(
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
