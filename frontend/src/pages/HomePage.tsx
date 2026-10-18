import { useOfflineRevision } from '../offline/useOfflineRevision.ts'
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Plus,
  ShoppingBag,
  Warehouse,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AddBovineModal } from '../components/dashboard/AddBovineModal.tsx'
import { CreateFarmModal } from '../components/dashboard/CreateFarmModal.tsx'
import { Field, fieldClass } from '../components/dashboard/Modal.tsx'
import { QuickWeighCard } from '../components/dashboard/QuickWeighCard.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useAuth } from '../auth/useAuth.ts'
import { useFarm } from '../context/useFarm.ts'
import { bovineLabel, createBovine, loadBovines } from '../lib/bovines.ts'
import { computeMetrics, greetingForNow, saleHints } from '../lib/dashboard.ts'
import { loadBovineAcquisitionCosts } from '../lib/sales.ts'
import { loadTasks, updateTaskDone } from '../lib/tasks.ts'
import { loadTreatments } from '../lib/sanitary.ts'
import {
  loadWeighings,
  saveWeighing,
} from '../lib/weighings.ts'
import { roleLabel } from '../lib/farms.ts'
import type { Bovine, BovineAcquisitionCost, SaleHint, Task, Treatment, Weighing } from '../types/dashboard.ts'

const saleCurrency = new Intl.NumberFormat('es-CR', {
  style: 'currency', currency: 'CRC', minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const saleUnit = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// RF-UC03-01, RF-UC05-01 y RF-UC11-02: coordina el resumen y las capturas rápidas de la finca.
export default function HomePage() {
  const revision = useOfflineRevision()
  const { user } = useAuth()
  const { farms, activeFarm, role, loading, setActiveFarmId, createAndSelectFarm } =
    useFarm()
  const [farmOpen, setFarmOpen] = useState(false)
  const [createFarmOpen, setCreateFarmOpen] = useState(false)
  const [addBovineOpen, setAddBovineOpen] = useState(false)
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [weighings, setWeighings] = useState<Weighing[]>([])
  const [acquisitionCosts, setAcquisitionCosts] = useState<BovineAcquisitionCost[]>([])
  const [expectedSalePrice, setExpectedSalePrice] = useState('')
  const [dailyMaintenance, setDailyMaintenance] = useState('')
  const [metrics, setMetrics] = useState({
    activeBulls: 0,
    averageGmd: null as number | null,
    weeklyGmd: null as number | null,
    pendingAlerts: 0,
  })
  const [toast, setToast] = useState<{
    message: string
    tone: 'ok' | 'warn' | 'error'
  } | null>(null)

  const displayName =
    (typeof user?.user_metadata.nombre_completo === 'string' &&
      user.user_metadata.nombre_completo) ||
    user?.email ||
    'productor'

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!activeFarm || !user) {
      setBovines([])
      setTasks([])
      setTreatments([])
      setWeighings([])
      setAcquisitionCosts([])
      setMetrics({ activeBulls: 0, averageGmd: null, weeklyGmd: null, pendingAlerts: 0 })
      return
    }

    const farmId = activeFarm.id
    let active = true
    // Carga el hato y sus datos asociados, descartando respuestas de una finca anterior.
    async function load() {
      try {
        const nextBovines = await loadBovines(farmId)
        const ids = nextBovines.map((item) => item.id)
        const [nextWeighings, nextTasks, nextTreatments, nextCosts] = await Promise.all([
          loadWeighings(ids, farmId),
          loadTasks(farmId),
          loadTreatments(ids, farmId),
          role === 'admin' ? loadBovineAcquisitionCosts(farmId) : Promise.resolve([]),
        ])
        if (!active) return
        setBovines(nextBovines)
        setTasks(nextTasks)
        setTreatments(nextTreatments)
        setWeighings(nextWeighings)
        setAcquisitionCosts(nextCosts)
        setMetrics(computeMetrics(nextBovines, nextWeighings, nextTreatments))
      } catch {
        if (!active) return
        setToast({
          message: 'No se pudieron cargar los datos de la finca.',
          tone: 'error',
        })
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [activeFarm, role, user, revision])

  const salePrice = parseSaleAmount(expectedSalePrice, false)
  const maintenance = parseSaleAmount(dailyMaintenance, true)
  const hints = useMemo(() => saleHints(bovines, weighings, acquisitionCosts, {
    expectedPricePerKg: salePrice,
    maintenancePerDay: maintenance,
  }), [acquisitionCosts, bovines, maintenance, salePrice, weighings])

  const todayTreatments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return treatments.filter((item) => item.proxima_aplicacion === today)
  }, [treatments])

  // RF-UC03-01: crea y selecciona una finca desde el formulario de Inicio.
  async function handleCreateFarm(nombre: string, ubicacion: string) {
    await createAndSelectFarm(nombre, ubicacion)
    setToast({ message: 'Finca creada y seleccionada', tone: 'ok' })
  }

  // RF-UC04-01: persiste el alta rápida y actualiza el hato visible.
  async function handleCreateBovine(
    payload: Omit<Parameters<typeof createBovine>[0], 'finca_id'>,
  ) {
    if (!activeFarm?.activo || role !== 'admin') throw new Error('Esta operación requiere administrador de una finca activa.')
    const created = await createBovine({ ...payload, finca_id: activeFarm.id })
    setBovines((current) => [created, ...current])
    setMetrics((current) => ({
      ...current,
      activeBulls:
        created.estado === 'ACTIVO'
          ? current.activeBulls + 1
          : current.activeBulls,
    }))
    setToast({ message: 'Bovino guardado en la finca activa', tone: 'ok' })
  }

  // RF-UC05-01 y RF-TR-01: captura el pesaje mediante la cola compartida.
  async function handleSaveWeighing(payload: {
    bovino_id: string
    peso_kg: number
    fecha_pesaje: string
  }) {
    if (!activeFarm) throw new Error('Selecciona una finca primero.')
    try {
      await saveWeighing(payload, activeFarm.id)
      setToast({ message: 'Pesaje guardado en el dispositivo; pendiente de sincronizar.', tone: 'warn' })
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : 'No se pudo guardar el pesaje.', tone: 'error' })
      throw cause
    }
  }

  // RF-UC11-02: solicita cambiar el estado de la tarea y actualiza la lista de Inicio.
  async function toggleTask(task: Task, done: boolean) {
    if (!activeFarm) return
    try {
      await updateTaskDone(task.id, done, activeFarm.id)
      setTasks((current) => current.map((item) => item.id === task.id
        ? { ...item, estado: done ? 'COMPLETADA' : 'PENDIENTE' } : item))
    } catch {
      setToast({ message: 'No se pudo actualizar la tarea', tone: 'error' })
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <header className="mb-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-xl font-semibold text-stone-900">
              BoviTrack
            </p>
            <p className="text-[11px] font-medium tracking-[0.18em] text-stone-500">
              GANADERÍA & CAMPO
            </p>
          </div>

        </div>

        <h1 className="font-serif text-3xl leading-tight font-semibold text-stone-900">
          {greetingForNow(displayName.split(' ')[0])}
        </h1>
        <p className="mt-1 text-sm text-stone-500">{roleLabel(role)}</p>

        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setFarmOpen((open) => !open)}
            className="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 text-left shadow-sm"
          >
            <span>
              <span className="block text-[11px] font-medium tracking-wide text-stone-400">
                Finca activa
              </span>
              <span className="text-sm font-semibold text-stone-900">
                {loading
                  ? 'Cargando…'
                  : activeFarm?.nombre ?? 'Sin finca seleccionada'}
              </span>
            </span>
            <ChevronDown className="size-4 text-stone-400" />
          </button>
          {farmOpen ? (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
              {farms.map((farm) => (
                <li key={farm.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFarmId(farm.id)
                      setFarmOpen(false)
                    }}
                    className={`w-full cursor-pointer px-4 py-3 text-left text-sm ${farm.id === activeFarm?.id
                      ? 'bg-bovi/10 font-medium text-bovi'
                      : 'text-stone-700 hover:bg-cream'
                      }`}
                  >
                    <span className="block">{farm.nombre}</span>
                    {farm.ubicacion ? (
                      <span className="text-xs text-stone-400">
                        {farm.ubicacion}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setFarmOpen(false)
                    setCreateFarmOpen(true)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 border-t border-stone-100 bg-cream px-4 py-3 text-left text-sm font-semibold text-bovi"
                >
                  <Plus className="size-4" />
                  Crear nueva finca
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          icon={<Activity className="size-4" />}
          label="Toros activos"
          value={String(metrics.activeBulls)}
        />
        <MetricCard
          icon={<Bell className="size-4" />}
          label="GMD global"
          value={
            metrics.averageGmd == null
              ? '—'
              : `${metrics.averageGmd.toFixed(2)} kg`
          }
        />
        <MetricCard
          icon={<CalendarDays className="size-4" />}
          label="GMD semanal"
          value={
            metrics.weeklyGmd == null
              ? '—'
              : `${metrics.weeklyGmd.toFixed(2)} kg`
          }
        />
        <MetricCard
          icon={<AlertTriangle className="size-4" />}
          label="Alertas"
          value={String(metrics.pendingAlerts)}
        />
      </div>

      <QuickWeighCard
        bovines={bovines}
        disabled={!activeFarm}
        onAddBovine={role === 'admin' && activeFarm?.activo ? () => setAddBovineOpen(true) : undefined}
        onSave={handleSaveWeighing}
      />

      <section className="mt-5 space-y-4">
        {role !== 'admin' ? (
          <>
            <Card
              title="Mis tareas del día"
              action={
                <Link to="/tareas" className="text-sm font-medium text-bovi">
                  Ver todas
                </Link>
              }
            >
              {tasks.length === 0 ? (
                <p className="text-sm text-stone-400">
                  No hay tareas asignadas para hoy.
                </p>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((task) => {
                    const done = task.estado === 'COMPLETADA'
                    return (
                      <li key={task.id}>
                        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-cream px-3 py-3">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(event) =>
                              toggleTask(task, event.target.checked)
                            }
                            className="mt-1 size-5 accent-bovi"
                          />
                          <span>
                            <span
                              className={`block text-sm font-medium ${done ? 'text-stone-400 line-through' : 'text-stone-800'}`}
                            >
                              {task.titulo}
                            </span>
                            {task.descripcion ? (
                              <span className="text-xs text-stone-500">
                                {task.descripcion}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
            <Card title="Próximas dosis / tratamientos">
              {todayTreatments.length === 0 ? (
                <p className="text-sm text-stone-400">
                  No hay tratamientos programados para hoy.
                </p>
              ) : (
                <ul className="space-y-2">
                  {todayTreatments.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl bg-cream px-3 py-3 text-sm text-stone-700"
                    >
                      <span className="font-medium text-stone-900">
                        {item.bovino
                          ? bovineLabel(item.bovino)
                          : 'Bovino'}
                      </span>
                      <span className="mt-1 block text-xs text-stone-500">
                        {item.observaciones || 'Aplicación programada'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Shortcut
              to="/tareas"
              icon={<ClipboardList className="size-5" />}
              label="Asignar y ver tareas"
            />
          </>
        ) : (
          <>
            <Card title="Evaluación de venta">
              <p className="mb-4 text-sm text-stone-500">
                Compara el precio esperado con el punto de equilibrio actual. El GMD usa los pesajes de la ventana de 56 días y no proyecta pesos futuros.
              </p>
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <Field id="expected-sale-price" label="Precio esperado (CRC/kg)">
                  <input
                    id="expected-sale-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={expectedSalePrice}
                    onChange={(event) => setExpectedSalePrice(event.target.value)}
                    placeholder="Ej. 1 500"
                    className={fieldClass}
                  />
                </Field>
                <Field id="daily-maintenance" label="Mantenimiento diario por toro (CRC/día)">
                  <input
                    id="daily-maintenance"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={dailyMaintenance}
                    onChange={(event) => setDailyMaintenance(event.target.value)}
                    placeholder="Ej. 800"
                    className={fieldClass}
                  />
                </Field>
              </div>
              {hints.length === 0 ? (
                <p className="text-sm text-stone-400">
                  Agrega bovinos activos y pesajes para revisar su rentabilidad.
                </p>
              ) : (
                <ul className="space-y-2">
                  {hints.map((hint) => (
                    <li
                      key={hint.bovine.id}
                      className="rounded-xl bg-cream px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-stone-900">{bovineLabel(hint.bovine)}</span>
                        <SaleBadge status={hint.status} />
                      </div>
                      <p className="mt-1 text-xs text-stone-500">{hint.detail}</p>
                      {hint.status === 'rentable' || hint.status === 'no_rentable' ? (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-600 sm:grid-cols-3">
                            <span>Peso actual: <strong>{saleUnit.format(hint.currentWeight ?? 0)} kg</strong></span>
                            <span>GMD 56 días: <strong>{hint.recentGmd == null ? '—' : `${saleUnit.format(hint.recentGmd)} kg/día`}</strong></span>
                            <span>Pesajes válidos: <strong>{hint.weighings}/8+</strong></span>
                            <span>Compra + flete: <strong>{saleCurrency.format(hint.acquisitionCost ?? 0)}</strong></span>
                            <span>Mantenimiento acumulado: <strong>{saleCurrency.format(hint.maintenanceCost ?? 0)}</strong></span>
                            <span>Costo acumulado: <strong>{saleCurrency.format(hint.accumulatedCost ?? 0)}</strong></span>
                            <span>Equilibrio: <strong>{saleCurrency.format(hint.breakEvenPrice ?? 0)}/kg</strong></span>
                            <span>Esperado: <strong>{saleCurrency.format(salePrice ?? 0)}/kg</strong></span>
                            <span>Margen estimado hoy: <strong>{saleCurrency.format(hint.margin ?? 0)}</strong></span>
                          </div>
                          <SaleComparison
                            costs={hint.accumulatedCost ?? 0}
                            proceeds={hint.expectedRevenue ?? 0}
                            label={bovineLabel(hint.bovine)}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-stone-400">
                La evaluación suma compra, flete y el mantenimiento ingresado. No distribuye costos de inventario o sanidad porque no están vinculados históricamente a cada toro.
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <Shortcut
                to="/reporte"
                icon={<FileText className="size-5" />}
                label="Reporte semanal / PDF"
              />
              <Shortcut
                to="/inventario"
                icon={<Warehouse className="size-5" />}
                label="Movimiento de bodega"
              />
              <Shortcut
                to="/compras"
                icon={<ShoppingBag className="size-5" />}
                label="Compras en subasta"
              />
              <Shortcut
                to="/ventas"
                icon={<ShoppingBag className="size-5" />}
                label="Registrar y consultar ventas"
              />
              <Shortcut
                to="/tareas"
                icon={<ClipboardList className="size-5" />}
                label="Tareas del equipo"
              />
            </div>
          </>
        )}
      </section>

      <CreateFarmModal
        open={createFarmOpen}
        onClose={() => setCreateFarmOpen(false)}
        onCreate={handleCreateFarm}
      />
      <AddBovineModal
        open={addBovineOpen}
        farmName={activeFarm?.nombre ?? 'la finca activa'}
        onClose={() => setAddBovineOpen(false)}
        onCreate={handleCreateBovine}
      />
    </div>
  )
}

// Presenta un indicador del inicio con su icono, etiqueta y valor.
function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm">
      <div className="text-bovi">{icon}</div>
      <p className="mt-3 font-serif text-xl font-semibold text-stone-900">
        {value}
      </p>
      <p className="text-[11px] leading-tight text-stone-500">{label}</p>
    </div>
  )
}

// Presenta un bloque del inicio con título y acción opcional.
function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-stone-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// Presenta el resultado económico calculado para las condiciones actuales.
function SaleBadge({ status }: { status: SaleHint['status'] }) {
  const map = {
    falta_pesajes: { label: 'Faltan pesajes', className: 'bg-amber-100 text-amber-800' },
    falta_parametros: { label: 'Completa los parámetros', className: 'bg-amber-100 text-amber-800' },
    falta_costos: { label: 'Faltan costos de compra', className: 'bg-amber-100 text-amber-800' },
    rentable: { label: 'Rentable hoy', className: 'bg-bovi text-white' },
    no_rentable: { label: 'No rentable hoy', className: 'bg-rose-100 text-rose-800' },
  }
  const item = map[status]
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  )
}

// Compara gráficamente los ingresos brutos estimados hoy con los costos acumulados.
function SaleComparison({ costs, proceeds, label }: { costs: number; proceeds: number; label: string }) {
  const scale = Math.max(costs, proceeds, 1)
  const bars = [
    { label: 'Costos acumulados', value: costs, color: 'bg-stone-400' },
    { label: 'Ingreso al precio esperado', value: proceeds, color: 'bg-bovi' },
  ]
  return (
    <div role="img" aria-label={`Comparación para ${label}: costos ${saleCurrency.format(costs)}, ingreso esperado ${saleCurrency.format(proceeds)}`} className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="mb-1 flex justify-between gap-2 text-[11px] text-stone-500">
            <span>{bar.label}</span><span>{saleCurrency.format(bar.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${Math.max(bar.value / scale * 100, 1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Convierte campos numéricos vacíos o inválidos en null para no activar evaluaciones parciales.
function parseSaleAmount(value: string, allowZero: boolean) {
  if (value.trim() === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) return null
  return amount
}

// Presenta un enlace de acceso a otro módulo de la aplicación.
function Shortcut({
  to,
  icon,
  label,
}: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-stone-200/80 bg-white p-4 text-sm font-medium text-stone-800 shadow-sm"
    >
      <span className="text-bovi">{icon}</span>
      {label}
    </Link>
  )
}
