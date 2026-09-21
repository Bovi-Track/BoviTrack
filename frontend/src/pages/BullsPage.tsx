import {
  Beef,
  Bug,
  ChevronLeft,
  ChevronRight,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Field, Modal, fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import { bovineLabel, loadBovines, todayIso } from '../lib/dashboard.ts'
import type { Bovine } from '../types/dashboard.ts'

const emptyForm = {
  numero_diio: '',
  identificador_interno: '',
  nombre: '',
  raza: '',
  color: '',
  sexo: 'MACHO',
  fecha_nacimiento: '',
  fecha_ingreso: todayIso(),
}

const statusLabel: Record<Bovine['estado'], string> = {
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  VENDIDO: 'Vendido',
  BAJA: 'Baja',
  MUERTO: 'Muerto',
}

type SanitaryKind =
  | 'VACUNACION'
  | 'DESPARASITACION'
  | 'VITAMINIZACION'
  | 'TRATAMIENTO'

type PlanStatus = 'vacio' | 'vencido' | 'proximo' | 'aldia' | 'sin_proxima'

type SanitaryRecord = {
  id: string
  bovino_id: string
  tipo: SanitaryKind
  producto: string
  dosis: string
  fecha: string
  proxima: string
  responsable: string
  observaciones: string
}

const kinds: {
  id: SanitaryKind
  label: string
  short: string
  icon: LucideIcon
  chip: string
  bar: string
  placeholder: string
}[] = [
  {
    id: 'VACUNACION',
    label: 'Vacunación',
    short: 'Vacuna',
    icon: Syringe,
    chip: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-600',
    placeholder: 'Clostridial, aftosa, rabia…',
  },
  {
    id: 'DESPARASITACION',
    label: 'Desparasitación',
    short: 'Desparasitar',
    icon: Bug,
    chip: 'bg-amber-100 text-amber-900',
    bar: 'bg-amber-500',
    placeholder: 'Ivermectina, albendazol…',
  },
  {
    id: 'VITAMINIZACION',
    label: 'Vitaminización',
    short: 'Vitaminas',
    icon: Pill,
    chip: 'bg-sky-100 text-sky-900',
    bar: 'bg-sky-600',
    placeholder: 'Complejo B, ADE…',
  },
  {
    id: 'TRATAMIENTO',
    label: 'Tratamiento médico',
    short: 'Tratamiento',
    icon: Stethoscope,
    chip: 'bg-rose-100 text-rose-800',
    bar: 'bg-rose-600',
    placeholder: 'Antibiótico, antiinflamatorio…',
  },
]

const kindById = Object.fromEntries(kinds.map((item) => [item.id, item])) as Record<
  SanitaryKind,
  (typeof kinds)[number]
>

const planStatusLabel: Record<PlanStatus, string> = {
  vacio: 'Sin registro',
  vencido: 'Vencido',
  proximo: 'Próximo',
  aldia: 'Al día',
  sin_proxima: 'Aplicado',
}

const planStatusClass: Record<PlanStatus, string> = {
  vacio: 'bg-stone-100 text-stone-600',
  vencido: 'bg-red-100 text-red-800',
  proximo: 'bg-amber-100 text-amber-900',
  aldia: 'bg-bovi/10 text-bovi',
  sin_proxima: 'bg-stone-100 text-stone-700',
}

function emptyPlan(bovinoId = '', tipo: SanitaryKind = 'VACUNACION') {
  return {
    bovino_id: bovinoId,
    tipo,
    producto: '',
    dosis: '',
    fecha: todayIso(),
    proxima: '',
    responsable: '',
    observaciones: '',
  }
}

function formatIso(iso: string) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

function latestOf(records: SanitaryRecord[], tipo: SanitaryKind) {
  return records
    .filter((item) => item.tipo === tipo)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))[0]
}

function planStatus(record: SanitaryRecord | undefined): PlanStatus {
  if (!record) return 'vacio'
  if (!record.proxima) return 'sin_proxima'
  const today = todayIso()
  if (record.proxima < today) return 'vencido'
  if (record.proxima <= addDays(today, 14)) return 'proximo'
  return 'aldia'
}

function worstStatus(records: SanitaryRecord[]): PlanStatus {
  const statuses = kinds.map((kind) => planStatus(latestOf(records, kind.id)))
  if (statuses.includes('vencido')) return 'vencido'
  if (statuses.includes('proximo')) return 'proximo'
  if (statuses.includes('aldia') || statuses.includes('sin_proxima')) return 'aldia'
  return 'vacio'
}

export default function BullsPage() {
  const { activeFarm, loading } = useFarm()
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<'hato' | 'sanidad'>('hato')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [records, setRecords] = useState<SanitaryRecord[]>([])
  const [kindFilter, setKindFilter] = useState<SanitaryKind | 'TODOS'>('TODOS')
  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState(emptyPlan())

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setRecords([])
    setSelectedId(null)
    setKindFilter('TODOS')
  }, [activeFarm?.id])

  useEffect(() => {
    if (!activeFarm) {
      setBovines([])
      return
    }
    const farmId = activeFarm.id
    let active = true
    loadBovines(farmId)
      .then((rows) => {
        if (active) setBovines(rows)
      })
      .catch(() => {
        if (active) setToast('No se pudieron cargar los toros.')
      })
    return () => {
      active = false
    }
  }, [activeFarm])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return bovines
    return bovines.filter((item) =>
      [item.nombre ?? '', item.identificador_interno, item.numero_diio, item.raza ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [bovines, query])

  const selected = bovines.find((item) => item.id === selectedId) ?? null

  const visibleRecords = useMemo(() => {
    const term = query.trim().toLowerCase()
    return records.filter((item) => {
      if (kindFilter !== 'TODOS' && item.tipo !== kindFilter) return false
      if (!term) return true
      const bovine = bovines.find((entry) => entry.id === item.bovino_id)
      const haystack = [
        item.producto,
        item.responsable,
        item.observaciones,
        kindById[item.tipo].label,
        bovine ? bovineLabel(bovine) : '',
        bovine?.numero_diio ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [bovines, kindFilter, query, records])

  function update(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updatePlan(key: keyof ReturnType<typeof emptyPlan>, value: string) {
    setPlanForm((current) => ({ ...current, [key]: value }))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    setForm({ ...emptyForm, fecha_ingreso: todayIso() })
    setToast('Interfaz lista. El guardado de toros se habilitará pronto.')
  }

  function openPlan(bovinoId: string, tipo: SanitaryKind = 'VACUNACION') {
    setPlanForm(emptyPlan(bovinoId, tipo))
    setPlanOpen(true)
  }

  function onSubmitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planForm.bovino_id) return
    const record: SanitaryRecord = {
      id: crypto.randomUUID(),
      bovino_id: planForm.bovino_id,
      tipo: planForm.tipo,
      producto: planForm.producto.trim(),
      dosis: planForm.dosis.trim(),
      fecha: planForm.fecha,
      proxima: planForm.proxima,
      responsable: planForm.responsable.trim(),
      observaciones: planForm.observaciones.trim(),
    }
    setRecords((current) => [record, ...current])
    setSelectedId(record.bovino_id)
    setKindFilter('TODOS')
    setPlanOpen(false)
    setPlanForm(emptyPlan())
    setToast('Vista previa. La aplicación quedó en esta sesión y aún no se guarda.')
  }

  function removeRecord(id: string) {
    setRecords((current) => current.filter((item) => item.id !== id))
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 pt-10 text-sm text-stone-500">Cargando…</p>
  }

  const planKind = kindById[planForm.tipo]

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast} tone="warn" /> : null}

      {selected ? (
        <BullSanitaryDetail
          bovine={selected}
          records={records.filter((item) => item.bovino_id === selected.id)}
          kindFilter={kindFilter}
          onKindFilter={setKindFilter}
          onBack={() => {
            setSelectedId(null)
            setKindFilter('TODOS')
          }}
          onRegister={(tipo) => openPlan(selected.id, tipo)}
          onRemove={removeRecord}
        />
      ) : (
        <>
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
                HATO
              </p>
              <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
                Toros
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                {activeFarm
                  ? `${filtered.length} ${filtered.length === 1 ? 'bovino' : 'bovinos'} en ${activeFarm.nombre}`
                  : 'Selecciona una finca desde Inicio para ver el hato.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={!activeFarm}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="size-4" />
              Agregar
            </button>
          </header>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-stone-200/60 p-1">
            <SegmentButton
              active={view === 'hato'}
              onClick={() => setView('hato')}
              label="Hato"
            />
            <SegmentButton
              active={view === 'sanidad'}
              onClick={() => setView('sanidad')}
              label="Sanidad"
            />
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${fieldClass} pl-10`}
              placeholder={
                view === 'hato'
                  ? 'Buscar por DIIO, identificador o nombre'
                  : 'Buscar por toro, producto o responsable'
              }
            />
          </div>

          {view === 'sanidad' ? (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <FilterChip
                active={kindFilter === 'TODOS'}
                onClick={() => setKindFilter('TODOS')}
                label="Todos"
              />
              {kinds.map((kind) => (
                <FilterChip
                  key={kind.id}
                  active={kindFilter === kind.id}
                  onClick={() => setKindFilter(kind.id)}
                  label={kind.short}
                />
              ))}
            </div>
          ) : null}

          {view === 'hato' ? (
            filtered.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
                <Beef className="mx-auto size-10 text-stone-300" />
                <p className="mt-3 font-serif text-xl font-semibold text-stone-800">
                  Sin toros para mostrar
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Usa Agregar para ver el formulario de registro.
                </p>
              </section>
            ) : (
              <ul className="space-y-3">
                {filtered.map((item) => {
                  const own = records.filter((record) => record.bovino_id === item.id)
                  const summary = worstStatus(own)
                  const attention = kinds
                    .map((kind) => {
                      const record = latestOf(own, kind.id)
                      return { kind, record, status: planStatus(record) }
                    })
                    .filter(
                      (entry) => entry.status === 'vencido' || entry.status === 'proximo',
                    )
                    .sort((a, b) => {
                      if (a.status !== b.status) return a.status === 'vencido' ? -1 : 1
                      return (a.record?.proxima ?? '').localeCompare(b.record?.proxima ?? '')
                    })[0]
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setKindFilter('TODOS')
                          setSelectedId(item.id)
                        }}
                        className="w-full cursor-pointer rounded-3xl border border-stone-200/80 bg-white p-4 text-left shadow-sm transition hover:border-bovi/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-stone-900">{bovineLabel(item)}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              DIIO {item.numero_diio}
                              {item.raza ? ` · ${item.raza}` : ''}
                              {` · ${item.sexo === 'MACHO' ? 'Macho' : 'Hembra'}`}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              item.estado === 'ACTIVO'
                                ? 'bg-bovi/10 text-bovi'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {statusLabel[item.estado]}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                          <span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${planStatusClass[summary]}`}
                            >
                              {own.length === 0 ? 'Sin plan sanitario' : planStatusLabel[summary]}
                            </span>
                            <span className="mt-1 block text-xs text-stone-500">
                              {attention?.record
                                ? `${attention.kind.short} · ${attention.record.producto} · ${formatIso(attention.record.proxima)}`
                                : own.length > 0
                                  ? `${own.length} aplicación${own.length === 1 ? '' : 'es'} en esta sesión`
                                  : 'Toca para ver vacunas, desparasitación y tratamientos'}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-stone-400" />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : (
            <SanitaryCalendar
              bovines={bovines}
              records={visibleRecords}
              canRegister={Boolean(activeFarm) && bovines.length > 0}
              onOpenBull={setSelectedId}
              onRegister={() => openPlan(filtered[0]?.id ?? bovines[0]?.id ?? '')}
            />
          )}
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Agregar toro"
        description="Vista previa del formulario. El registro aún no se guarda."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="toro-diio" label="Número DIIO-SENASA">
              <input
                id="toro-diio"
                required
                maxLength={50}
                value={form.numero_diio}
                onChange={(event) => update('numero_diio', event.target.value)}
                className={fieldClass}
                placeholder="CL-000123"
              />
            </Field>
            <Field id="toro-interno" label="Identificador interno">
              <input
                id="toro-interno"
                required
                maxLength={50}
                value={form.identificador_interno}
                onChange={(event) =>
                  update('identificador_interno', event.target.value)
                }
                className={fieldClass}
                placeholder="T-014"
              />
            </Field>
            <Field id="toro-nombre" label="Nombre (opcional)">
              <input
                id="toro-nombre"
                maxLength={100}
                value={form.nombre}
                onChange={(event) => update('nombre', event.target.value)}
                className={fieldClass}
                placeholder="Relámpago"
              />
            </Field>
            <Field id="toro-sexo" label="Sexo">
              <select
                id="toro-sexo"
                required
                value={form.sexo}
                onChange={(event) => update('sexo', event.target.value)}
                className={fieldClass}
              >
                <option value="MACHO">Macho</option>
                <option value="HEMBRA">Hembra</option>
              </select>
            </Field>
            <Field id="toro-raza" label="Raza (opcional)">
              <input
                id="toro-raza"
                maxLength={50}
                value={form.raza}
                onChange={(event) => update('raza', event.target.value)}
                className={fieldClass}
                placeholder="Angus"
              />
            </Field>
            <Field id="toro-color" label="Color (opcional)">
              <input
                id="toro-color"
                maxLength={20}
                value={form.color}
                onChange={(event) => update('color', event.target.value)}
                className={fieldClass}
                placeholder="Negro"
              />
            </Field>
            <Field id="toro-nacimiento" label="Fecha de nacimiento">
              <input
                id="toro-nacimiento"
                type="date"
                value={form.fecha_nacimiento}
                onChange={(event) =>
                  update('fecha_nacimiento', event.target.value)
                }
                className={fieldClass}
              />
            </Field>
            <Field id="toro-ingreso" label="Fecha de ingreso">
              <input
                id="toro-ingreso"
                type="date"
                required
                value={form.fecha_ingreso}
                onChange={(event) => update('fecha_ingreso', event.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
          <button
            type="submit"
            className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover"
          >
            Guardar toro
          </button>
        </form>
      </Modal>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Registrar aplicación"
        description="Queda en el historial de esta sesión. Aún no se guarda en la finca."
      >
        <form onSubmit={onSubmitPlan} className="space-y-4">
          <Field id="plan-toro" label="Toro">
            <select
              id="plan-toro"
              required
              value={planForm.bovino_id}
              onChange={(event) => updatePlan('bovino_id', event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Selecciona un toro
              </option>
              {bovines.map((item) => (
                <option key={item.id} value={item.id}>
                  {bovineLabel(item)}
                </option>
              ))}
            </select>
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-stone-800">
              Tipo de plan
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {kinds.map((kind) => {
                const Icon = kind.icon
                const active = planForm.tipo === kind.id
                return (
                  <button
                    key={kind.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updatePlan('tipo', kind.id)}
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium ${
                      active
                        ? 'border-bovi bg-bovi/10 text-bovi'
                        : 'border-stone-200 bg-white text-stone-700'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {kind.short}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Field id="plan-producto" label="Producto">
            <input
              id="plan-producto"
              required
              maxLength={80}
              value={planForm.producto}
              onChange={(event) => updatePlan('producto', event.target.value)}
              className={fieldClass}
              placeholder={planKind.placeholder}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="plan-dosis" label="Dosis">
              <input
                id="plan-dosis"
                required
                maxLength={40}
                value={planForm.dosis}
                onChange={(event) => updatePlan('dosis', event.target.value)}
                className={fieldClass}
                placeholder="5 ml"
              />
            </Field>
            <Field id="plan-fecha" label="Fecha de aplicación">
              <input
                id="plan-fecha"
                type="date"
                required
                value={planForm.fecha}
                onChange={(event) => updatePlan('fecha', event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="plan-proxima" label="Próxima aplicación">
              <input
                id="plan-proxima"
                type="date"
                value={planForm.proxima}
                onChange={(event) => updatePlan('proxima', event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="plan-responsable" label="Responsable">
              <input
                id="plan-responsable"
                maxLength={80}
                value={planForm.responsable}
                onChange={(event) => updatePlan('responsable', event.target.value)}
                className={fieldClass}
                placeholder="Nombre de quien aplicó"
              />
            </Field>
          </div>
          <Field id="plan-obs" label="Observaciones (opcional)">
            <textarea
              id="plan-obs"
              rows={3}
              maxLength={200}
              value={planForm.observaciones}
              onChange={(event) => updatePlan('observaciones', event.target.value)}
              className={`${fieldClass} resize-none`}
              placeholder="Lote, vía o reacción observada"
            />
          </Field>
          <button
            type="submit"
            className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover"
          >
            Guardar en el historial
          </button>
        </form>
      </Modal>
    </div>
  )
}

function BullSanitaryDetail({
  bovine,
  records,
  kindFilter,
  onKindFilter,
  onBack,
  onRegister,
  onRemove,
}: {
  bovine: Bovine
  records: SanitaryRecord[]
  kindFilter: SanitaryKind | 'TODOS'
  onKindFilter: (value: SanitaryKind | 'TODOS') => void
  onBack: () => void
  onRegister: (tipo: SanitaryKind) => void
  onRemove: (id: string) => void
}) {
  const history = [...records]
    .filter((item) => kindFilter === 'TODOS' || item.tipo === kindFilter)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-medium text-stone-500 hover:text-bovi"
      >
        <ChevronLeft className="size-4" />
        Volver al hato
      </button>

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
            PLAN SANITARIO
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            {bovineLabel(bovine)}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            DIIO {bovine.numero_diio}
            {bovine.raza ? ` · ${bovine.raza}` : ''}
            {` · ${bovine.sexo === 'MACHO' ? 'Macho' : 'Hembra'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRegister(kindFilter === 'TODOS' ? 'VACUNACION' : kindFilter)}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover"
        >
          <Plus className="size-4" />
          Aplicar
        </button>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2">
        {kinds.map((kind) => {
          const latest = latestOf(records, kind.id)
          const status = planStatus(latest)
          const Icon = kind.icon
          const selectedKind = kindFilter === kind.id
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() => onKindFilter(selectedKind ? 'TODOS' : kind.id)}
              className={`cursor-pointer rounded-2xl border bg-white p-3 text-left shadow-sm ${
                selectedKind ? 'border-bovi' : 'border-stone-200/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex rounded-full p-1.5 ${kind.chip}`}>
                  <Icon className="size-3.5" />
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${planStatusClass[status]}`}
                >
                  {planStatusLabel[status]}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-stone-900">{kind.short}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {latest
                  ? `${latest.producto} · ${formatIso(latest.fecha)}`
                  : 'Sin aplicaciones'}
              </p>
              {latest?.proxima ? (
                <p className="mt-1 text-xs font-medium text-stone-700">
                  Próxima {formatIso(latest.proxima)}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold text-stone-900">
            Historial
          </h2>
          {kindFilter !== 'TODOS' ? (
            <button
              type="button"
              onClick={() => onKindFilter('TODOS')}
              className="cursor-pointer text-xs font-medium text-bovi"
            >
              Ver todos
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-stone-500">
            {kindFilter === 'TODOS'
              ? 'Todavía no hay aplicaciones. Usa Aplicar para registrar la primera.'
              : `No hay ${kindById[kindFilter].label.toLowerCase()} en esta sesión.`}
          </p>
        ) : (
          <ol className="space-y-4">
            {history.map((item) => (
              <HistoryItem key={item.id} item={item} onRemove={onRemove} />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function SanitaryCalendar({
  bovines,
  records,
  canRegister,
  onOpenBull,
  onRegister,
}: {
  bovines: Bovine[]
  records: SanitaryRecord[]
  canRegister: boolean
  onOpenBull: (id: string) => void
  onRegister: () => void
}) {
  const today = todayIso()
  const latestByPlan = new Map<string, SanitaryRecord>()
  for (const item of [...records].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    latestByPlan.set(`${item.bovino_id}:${item.tipo}`, item)
  }
  const upcoming = [...latestByPlan.values()]
    .filter((item) => item.proxima)
    .sort((a, b) => a.proxima.localeCompare(b.proxima))
  const history = [...records].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          Próximas dosis y aplicaciones de esta sesión.
        </p>
        <button
          type="button"
          onClick={onRegister}
          disabled={!canRegister}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="size-4" />
          Aplicar
        </button>
      </div>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-serif text-xl font-semibold text-stone-900">
          Por aplicar
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-stone-500">
            No hay próximas fechas. Al registrar una aplicación puedes indicar cuándo toca la siguiente.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((item) => {
              const bovine = bovines.find((entry) => entry.id === item.bovino_id)
              const overdue = item.proxima < today
              return (
                <li key={`${item.id}-next`}>
                  <button
                    type="button"
                    onClick={() => onOpenBull(item.bovino_id)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-cream px-3 py-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-medium text-stone-900">
                        {bovine ? bovineLabel(bovine) : 'Toro'}
                      </span>
                      <span className="text-xs text-stone-500">
                        {kindById[item.tipo].short} · {item.producto}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {overdue ? 'Vencida' : formatIso(item.proxima)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-serif text-xl font-semibold text-stone-900">
          Historial del hato
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-stone-500">
            El historial aparece aquí en cuanto registres una vacuna, desparasitación, vitamina o tratamiento.
          </p>
        ) : (
          <ol className="space-y-4">
            {history.map((item) => {
              const bovine = bovines.find((entry) => entry.id === item.bovino_id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpenBull(item.bovino_id)}
                    className="w-full cursor-pointer text-left"
                  >
                    <HistoryItem item={item} caption={bovine ? bovineLabel(bovine) : 'Toro'} />
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}

function HistoryItem({
  item,
  caption,
  onRemove,
}: {
  item: SanitaryRecord
  caption?: string
  onRemove?: (id: string) => void
}) {
  const kind = kindById[item.tipo]
  const Icon = kind.icon
  return (
    <div className="flex gap-3">
      <div className={`mt-1 h-full w-1 shrink-0 rounded-full ${kind.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-900">
              {caption ? `${caption} · ` : ''}
              {item.producto}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
              <Icon className="size-3.5" />
              {kind.label} · {formatIso(item.fecha)}
              {item.dosis ? ` · ${item.dosis}` : ''}
            </p>
          </div>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="cursor-pointer text-xs font-medium text-stone-400 hover:text-red-700"
            >
              Quitar
            </button>
          ) : null}
        </div>
        {item.proxima ? (
          <p className="mt-1 text-xs text-stone-600">Próxima {formatIso(item.proxima)}</p>
        ) : null}
        {item.responsable ? (
          <p className="mt-1 text-xs text-stone-500">Aplicó {item.responsable}</p>
        ) : null}
        {item.observaciones ? (
          <p className="mt-1 text-xs text-stone-500">{item.observaciones}</p>
        ) : null}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? 'bg-bovi text-white' : 'bg-white text-stone-600'
      }`}
    >
      {label}
    </button>
  )
}

function SegmentButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 cursor-pointer rounded-xl text-sm font-medium ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
      }`}
    >
      {label}
    </button>
  )
}
