import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  FileText,
  Plus,
  ShoppingBag,
  Warehouse,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AddBovineModal } from '../components/dashboard/AddBovineModal.tsx'
import { CreateFarmModal } from '../components/dashboard/CreateFarmModal.tsx'
import { QuickWeighCard } from '../components/dashboard/QuickWeighCard.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import {
  bovineLabel,
  computeMetrics,
  createBovine,
  greetingForNow,
  loadBovines,
  loadTasks,
  loadTreatments,
  loadWeighings,
  readPendingWeighings,
  roleLabel,
  saleHints,
  saveWeighing,
  updateTaskDone,
  writePendingWeighings,
} from '../lib/dashboard.ts'
import type { Bovine, SaleHint, Task, Treatment } from '../types/dashboard.ts'

export default function HomePage() {
  const { user } = useAuth()
  const { farms, activeFarm, role, loading, setActiveFarmId, createAndSelectFarm } =
    useFarm()
  const [farmOpen, setFarmOpen] = useState(false)
  const [createFarmOpen, setCreateFarmOpen] = useState(false)
  const [addBovineOpen, setAddBovineOpen] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [hints, setHints] = useState<SaleHint[]>([])
  const [metrics, setMetrics] = useState({
    activeBulls: 0,
    averageGmd: null as number | null,
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
    function onOnline() {
      setOnline(true)
    }
    function onOffline() {
      setOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

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
      setHints([])
      setMetrics({ activeBulls: 0, averageGmd: null, pendingAlerts: 0 })
      return
    }

    const farmId = activeFarm.id
    const userId = user.id
    let active = true
    async function load() {
      try {
        const nextBovines = await loadBovines(farmId)
        const ids = nextBovines.map((item) => item.id)
        const [weighings, nextTasks, nextTreatments] = await Promise.all([
          loadWeighings(ids),
          loadTasks(farmId, userId),
          loadTreatments(ids),
        ])
        if (!active) return
        setBovines(nextBovines)
        setTasks(nextTasks)
        setTreatments(nextTreatments)
        setMetrics(computeMetrics(nextBovines, weighings, nextTreatments))
        setHints(saleHints(nextBovines, weighings))
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
  }, [activeFarm, user])

  useEffect(() => {
    if (!online || !user) return
    const pending = readPendingWeighings()
    if (pending.length === 0) return
    const userId = user.id

    async function flush() {
      const remaining = []
      for (const item of pending) {
        try {
          await saveWeighing(item, userId)
        } catch {
          remaining.push(item)
        }
      }
      writePendingWeighings(remaining)
      if (remaining.length < pending.length) {
        setToast({ message: 'Pesajes locales sincronizados', tone: 'ok' })
      }
    }

    void flush()
  }, [online, user])

  const todayTreatments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return treatments.filter((item) => item.proxima_aplicacion === today)
  }, [treatments])

  async function handleCreateFarm(nombre: string, ubicacion: string) {
    await createAndSelectFarm(nombre, ubicacion)
    setToast({ message: 'Finca creada y seleccionada', tone: 'ok' })
  }

  async function handleCreateBovine(
    payload: Omit<Parameters<typeof createBovine>[0], 'finca_id'>,
  ) {
    if (!activeFarm) throw new Error('Selecciona una finca primero.')
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

  async function handleSaveWeighing(payload: {
    bovino_id: string
    peso_kg: number
    fecha_pesaje: string
  }) {
    if (!online) {
      writePendingWeighings([...readPendingWeighings(), payload])
      setToast({ message: 'Guardado local. Se sincronizará al volver online.', tone: 'warn' })
      return
    }

    try {
      await saveWeighing(payload, user?.id)
      setToast({ message: 'Pesaje guardado y sincronizado', tone: 'ok' })
    } catch {
      writePendingWeighings([...readPendingWeighings(), payload])
      setToast({
        message: 'Sin conexión al servidor. Pesaje guardado localmente.',
        tone: 'warn',
      })
    }
  }

  async function toggleTask(task: Task, done: boolean) {
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, estado: done ? 'COMPLETADA' : 'PENDIENTE' }
          : item,
      ),
    )
    try {
      await updateTaskDone(task.id, done)
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
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              online
                ? 'bg-bovi/10 text-bovi'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {online ? (
              <Wifi className="size-3.5" />
            ) : (
              <WifiOff className="size-3.5" />
            )}
            {online ? 'Online · Sincronizado' : 'Offline'}
          </span>
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
                    className={`w-full cursor-pointer px-4 py-3 text-left text-sm ${
                      farm.id === activeFarm?.id
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

      <div className="mb-5 grid grid-cols-3 gap-2">
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
          icon={<AlertTriangle className="size-4" />}
          label="Alertas"
          value={String(metrics.pendingAlerts)}
        />
      </div>

      <QuickWeighCard
        bovines={bovines}
        disabled={!activeFarm}
        onAddBovine={() => setAddBovineOpen(true)}
        onSave={handleSaveWeighing}
      />

      <section className="mt-5 space-y-4">
        {role === 'campo' ? (
          <>
            <Card title="Mis tareas del día">
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
          </>
        ) : (
          <>
            <Card title="Evaluación rápida de venta">
              {hints.length === 0 ? (
                <p className="text-sm text-stone-400">
                  Agrega bovinos y pesajes para sugerir ventas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {hints.map((hint) => (
                    <li
                      key={hint.bovine.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-3"
                    >
                      <span>
                        <span className="block text-sm font-medium text-stone-900">
                          {bovineLabel(hint.bovine)}
                        </span>
                        <span className="text-xs text-stone-500">
                          {hint.detail}
                        </span>
                      </span>
                      <SaleBadge status={hint.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="grid gap-2 sm:grid-cols-3">
              <Shortcut
                to="/ajustes"
                icon={<FileText className="size-5" />}
                label="Generar reporte PDF"
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

function Card({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-serif text-xl font-semibold text-stone-900">
        {title}
      </h2>
      {children}
    </section>
  )
}

function SaleBadge({ status }: { status: SaleHint['status'] }) {
  const map = {
    apto: { label: 'Apto para venta', className: 'bg-bovi text-white' },
    falta: { label: 'Falta información', className: 'bg-amber-100 text-amber-800' },
    mantener: { label: 'Mantener', className: 'bg-stone-200 text-stone-700' },
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
