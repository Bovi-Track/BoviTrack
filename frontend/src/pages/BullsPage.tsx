import { useOfflineRevision } from '../offline/useOfflineRevision.ts'
import { HistoryItem } from '../components/bovines/SanitaryHistoryItem.tsx'
import {
  bovineStatusLabel,
  bovineErrorMessage,
  bovineLabel,
  createBovines,
  loadBovines,
  updateBovine,
} from '../lib/bovines.ts'
import { BullSanitaryDetail } from '../components/bovines/BovineDetail.tsx'
import { DisposalSection } from '../components/bovines/DisposalSection.tsx'
import {
  kinds,
  kindById,
  planStatusLabel,
  planStatusClass,
} from '../components/bovines/sanitary-options.ts'
import {
  latestOf,
  planStatus,
  worstStatus,
  loadSanitaryRecords,
  createSanitaryRecord,
} from '../lib/sanitary.ts'
import { SegmentButton } from '../components/dashboard/SegmentButton.tsx'
import { formatDayLong as formatIso, todayIso } from '../lib/dates.ts'
import type { SanitaryKind, SanitaryRecord } from '../types/sanitary.ts'
import { Beef, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Field, Modal, fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/useFarm.ts'
import { loadWeighings } from '../lib/weighings.ts'
import type { Bovine, BovineStatus, Weighing } from '../types/dashboard.ts'

type BullDraft = {
  localId: string
  numero_diio: string
  identificador_interno: string
  nombre: string
  raza: string
  color: string
  sexo: 'MACHO' | 'HEMBRA'
  fecha_nacimiento: string
  fecha_ingreso: string
}

type DraftField = Exclude<keyof BullDraft, 'localId'>

type EditForm = {
  identificador_interno: string
  nombre: string
  raza: string
  color: string
  estado: BovineStatus
}

// Inicializa un toro del formulario múltiple con identificador local y fecha de ingreso.
function newDraft(): BullDraft {
  return {
    localId: crypto.randomUUID(),
    numero_diio: '',
    identificador_interno: '',
    nombre: '',
    raza: '',
    color: '',
    sexo: 'MACHO',
    fecha_nacimiento: '',
    fecha_ingreso: todayIso(),
  }
}

// Convierte la ficha persistida del toro en valores editables del formulario.
function editFrom(bovine: Bovine): EditForm {
  return {
    identificador_interno: bovine.identificador_interno,
    nombre: bovine.nombre ?? '',
    raza: bovine.raza ?? '',
    color: bovine.color ?? '',
    estado: bovine.estado,
  }
}

// Inicializa el formulario sanitario con toro, tipo de aplicación y fecha local.
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

// RF-UC04-01, RF-UC07-01/02 y RF-UC13-01: coordina altas, ficha, sanidad y bajas del hato.
export default function BullsPage() {
  const revision = useOfflineRevision()
  const { activeFarm, role, loading } = useFarm()
  const canManage = role === 'admin' && Boolean(activeFarm?.activo)
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [weighings, setWeighings] = useState<Weighing[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<BullDraft[]>(() => [newDraft()])
  const [addError, setAddError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    identificador_interno: '',
    nombre: '',
    raza: '',
    color: '',
    estado: 'ACTIVO',
  })
  const [editError, setEditError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    tone: 'ok' | 'warn' | 'error'
  } | null>(null)
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
      setWeighings([])
      return
    }
    const farmId = activeFarm.id
    let active = true
    // Carga toros, pesajes y sanidad para la finca actual y descarta respuestas antiguas.
    async function load() {
      try {
        const rows = await loadBovines(farmId)
        const nextWeighings = await loadWeighings(rows.map((item) => item.id), farmId)
        const nextRecords = await loadSanitaryRecords(farmId)
        if (!active) return
        setBovines(rows)
        setWeighings(nextWeighings)
        setRecords(nextRecords)
      } catch {
        if (active) {
          setToast({ message: 'No se pudieron cargar los toros.', tone: 'error' })
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [activeFarm, revision])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return bovines
    return bovines.filter((item) =>
      [item.nombre ?? '', item.identificador_interno, item.numero_diio ?? '', item.raza ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [bovines, query])

  const selected = bovines.find((item) => item.id === selectedId && item.finca_id === activeFarm?.id) ?? null

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

  // Actualiza un campo del toro indicado dentro del formulario múltiple.
  function updateDraft(localId: string, key: DraftField, value: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.localId === localId ? { ...draft, [key]: value } : draft,
      ),
    )
  }

  // Actualiza un campo del formulario de aplicación sanitaria.
  function updatePlan(key: keyof ReturnType<typeof emptyPlan>, value: string) {
    setPlanForm((current) => ({ ...current, [key]: value }))
  }

  // Inicializa y abre el formulario de alta múltiple de toros.
  function openAdd() {
    setDrafts([newDraft()])
    setAddError('')
    setOpen(true)
  }

  // Carga la ficha del toro seleccionado en el formulario de edición.
  function openEdit() {
    if (!selected) return
    setEditForm(editFrom(selected))
    setEditError('')
    setEditOpen(true)
  }

  // RF-UC04-01: valida y persiste el alta múltiple de toros en la finca seleccionada.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeFarm || !canManage) {
      setAddError('Selecciona una finca activa desde Inicio.')
      return
    }

    const payloads = drafts.map((draft) => ({
      finca_id: activeFarm.id,
      numero_diio: draft.numero_diio.trim() || null,
      identificador_interno: draft.identificador_interno.trim(),
      nombre: draft.nombre.trim() || null,
      raza: draft.raza.trim() || null,
      color: draft.color.trim() || null,
      sexo: draft.sexo,
      fecha_nacimiento: draft.fecha_nacimiento || null,
      fecha_ingreso: draft.fecha_ingreso,
    }))

    const diios = payloads
      .map((item) => item.numero_diio?.toLowerCase())
      .filter((value): value is string => Boolean(value))
    const internals = payloads.map((item) => item.identificador_interno.toLowerCase())
    if (new Set(diios).size !== diios.length || new Set(internals).size !== internals.length) {
      setAddError('Los números DIIO y los identificadores internos no pueden repetirse.')
      return
    }

    setAddError('')
    setSubmitting(true)
    try {
      const created = await createBovines(payloads)
      setBovines((current) => [...created, ...current])
      setOpen(false)
      setDrafts([newDraft()])
      setToast({
        message:
          created.length === 1
            ? 'Toro guardado en la finca activa.'
            : `${created.length} toros guardados en la finca activa.`,
        tone: 'ok',
      })
    } catch (cause) {
      setAddError(bovineErrorMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  // RF-UC04-01 (parcial): guarda la ficha; las transiciones de UC-12/13 siguen pendientes.
  async function onSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !canManage) return
    const identificador = editForm.identificador_interno.trim()
    if (!identificador) {
      setEditError('El identificador interno es obligatorio.')
      return
    }
    setEditError('')
    setSubmitting(true)
    try {
      const updated = await updateBovine(selected.id, {
        identificador_interno: identificador,
        nombre: editForm.nombre.trim() || null,
        raza: editForm.raza.trim() || null,
        color: editForm.color.trim() || null,
        estado: editForm.estado,
      })
      setBovines((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setEditOpen(false)
      setToast({ message: 'Ficha del bovino actualizada.', tone: 'ok' })
    } catch (cause) {
      setEditError(bovineErrorMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  // Inicializa el formulario sanitario para el toro y tipo seleccionados.
  function openPlan(bovinoId: string, tipo: SanitaryKind = 'VACUNACION') {
    setPlanForm(emptyPlan(bovinoId, tipo))
    setPlanOpen(true)
  }

  // RF-UC07-01: valida dosis, solicita la aplicación y recarga el historial sanitario.
  async function onSubmitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planForm.bovino_id || !activeFarm) return

    if (!Number.isFinite(Number(planForm.dosis)) || Number(planForm.dosis) <= 0) {
      setToast({
        message: 'La dosis debe ser un número mayor que 0 (ej: 5 ml).',
        tone: 'error',
      })
      return
    }

    try {
      await createSanitaryRecord(
        planForm.bovino_id,
        planForm.tipo,
        planForm.producto.trim(),
        planForm.dosis.trim(),
        planForm.fecha,
        planForm.proxima || null,
        null,
        planForm.observaciones.trim() || null,
        activeFarm.id
      )

      if (activeFarm) {
        const nextRecords = await loadSanitaryRecords(activeFarm.id)
        setRecords(nextRecords)
      }

      setSelectedId(planForm.bovino_id)
      setKindFilter('TODOS')
      setPlanOpen(false)
      setPlanForm(emptyPlan())
      setToast({
        message: 'Registro sanitario guardado en el dispositivo; pendiente de sincronizar.',
        tone: 'ok',
      })
    } catch {
      setToast({
        message: 'No se pudo guardar el registro sanitario.',
        tone: 'error',
      })
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 pt-10 text-sm text-stone-500">Cargando…</p>
  }

  const planKind = kindById[planForm.tipo]

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      {selected ? (
        <>
        <BullSanitaryDetail
          bovine={selected}
          weighings={weighings.filter((item) => item.bovino_id === selected.id)}
          records={records.filter((item) => item.bovino_id === selected.id)}
          kindFilter={kindFilter}
          onKindFilter={setKindFilter}
          onBack={() => {
            setSelectedId(null)
            setKindFilter('TODOS')
          }}
          onEdit={canManage ? openEdit : undefined}
          onRegister={(tipo) => openPlan(selected.id, tipo)}
        />
        <DisposalSection
          key={`${selected.id}:${role}`}
          bovine={selected}
          admin={role === 'admin'}
          farmActive={Boolean(activeFarm?.activo)}
          onRegistered={() => setBovines((rows) => rows.map((row) => row.id === selected.id ? { ...row, estado: 'BAJA' } : row))}
        />
        </>
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
            {canManage ? <button
              type="button"
              onClick={openAdd}
              disabled={!activeFarm}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="size-4" />
              Agregar
            </button> : null}
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
                  Usa Agregar para registrar uno o varios toros.
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
                              {item.numero_diio ? `DIIO ${item.numero_diio}` : 'Sin DIIO'}
                              {item.raza ? ` · ${item.raza}` : ''}
                              {item.color ? ` · ${item.color}` : ''}
                              {` · ${item.sexo === 'MACHO' ? 'Macho' : 'Hembra'}`}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.estado === 'ACTIVO'
                              ? 'bg-bovi/10 text-bovi'
                              : 'bg-stone-100 text-stone-600'
                              }`}
                          >
                            {bovineStatusLabel(item.estado)}
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
        title={drafts.length === 1 ? 'Agregar toro' : `Agregar ${drafts.length} toros`}
        description={
          activeFarm
            ? `Se registrarán en ${activeFarm.nombre}. Puedes cargar varios de una vez.`
            : 'Selecciona una finca activa para guardar.'
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {drafts.map((draft, index) => {
            const prefix = `toro-${draft.localId}`
            return (
              <div
                key={draft.localId}
                className="rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-800">
                    Toro {index + 1}
                  </p>
                  {drafts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((current) =>
                          current.filter((item) => item.localId !== draft.localId),
                        )
                      }
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="size-3.5" />
                      Quitar
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`${prefix}-diio`} label="Número DIIO-SENASA (opcional)">
                    <input
                      id={`${prefix}-diio`}
                      maxLength={50}
                      value={draft.numero_diio}
                      onChange={(event) =>
                        updateDraft(draft.localId, 'numero_diio', event.target.value)
                      }
                      className={fieldClass}
                      placeholder="CL-000123"
                    />
                  </Field>
                  <Field id={`${prefix}-interno`} label="Identificador interno">
                    <input
                      id={`${prefix}-interno`}
                      required
                      maxLength={50}
                      value={draft.identificador_interno}
                      onChange={(event) =>
                        updateDraft(
                          draft.localId,
                          'identificador_interno',
                          event.target.value,
                        )
                      }
                      className={fieldClass}
                      placeholder="T-014"
                    />
                  </Field>
                  <Field id={`${prefix}-nombre`} label="Nombre (opcional)">
                    <input
                      id={`${prefix}-nombre`}
                      maxLength={100}
                      value={draft.nombre}
                      onChange={(event) =>
                        updateDraft(draft.localId, 'nombre', event.target.value)
                      }
                      className={fieldClass}
                      placeholder="Relámpago"
                    />
                  </Field>
                  <Field id={`${prefix}-sexo`} label="Sexo">
                    <select
                      id={`${prefix}-sexo`}
                      required
                      value={draft.sexo}
                      onChange={(event) =>
                        updateDraft(draft.localId, 'sexo', event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="MACHO">Macho</option>
                      <option value="HEMBRA">Hembra</option>
                    </select>
                  </Field>
                  <Field id={`${prefix}-raza`} label="Raza (opcional)">
                    <input
                      id={`${prefix}-raza`}
                      maxLength={50}
                      value={draft.raza}
                      onChange={(event) =>
                        updateDraft(draft.localId, 'raza', event.target.value)
                      }
                      className={fieldClass}
                      placeholder="Angus"
                    />
                  </Field>
                  <Field id={`${prefix}-color`} label="Color (opcional)">
                    <input
                      id={`${prefix}-color`}
                      maxLength={20}
                      value={draft.color}
                      onChange={(event) =>
                        updateDraft(draft.localId, 'color', event.target.value)
                      }
                      className={fieldClass}
                      placeholder="Negro"
                    />
                  </Field>
                  <Field id={`${prefix}-nacimiento`} label="Fecha de nacimiento (opcional)">
                    <input
                      id={`${prefix}-nacimiento`}
                      type="date"
                      value={draft.fecha_nacimiento}
                      onChange={(event) =>
                        updateDraft(
                          draft.localId,
                          'fecha_nacimiento',
                          event.target.value,
                        )
                      }
                      className={fieldClass}
                    />
                  </Field>
                  <Field id={`${prefix}-ingreso`} label="Fecha de ingreso">
                    <input
                      id={`${prefix}-ingreso`}
                      type="date"
                      required
                      value={draft.fecha_ingreso}
                      onChange={(event) =>
                        updateDraft(draft.localId, 'fecha_ingreso', event.target.value)
                      }
                      className={fieldClass}
                    />
                  </Field>
                </div>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setDrafts((current) => [...current, newDraft()])}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-bovi/40 bg-bovi/5 text-sm font-semibold text-bovi hover:bg-bovi/10"
          >
            <Plus className="size-4" />
            Agregar otro toro
          </button>
          {addError ? (
            <p className="text-sm text-red-600" role="alert">
              {addError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || !activeFarm}
            className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting
              ? 'Guardando…'
              : drafts.length === 1
                ? 'Guardar toro'
                : `Guardar ${drafts.length} toros`}
          </button>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar bovino"
        description={
          selected
            ? `${bovineLabel(selected)}${selected.numero_diio ? ` · DIIO ${selected.numero_diio}` : ''}`
            : undefined
        }
      >
        <form onSubmit={onSubmitEdit} className="space-y-4">
          <Field id="edit-interno" label="Identificador interno">
            <input
              id="edit-interno"
              required
              maxLength={50}
              value={editForm.identificador_interno}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  identificador_interno: event.target.value,
                }))
              }
              className={fieldClass}
              placeholder="T-014"
            />
          </Field>
          <Field id="edit-nombre" label="Nombre">
            <input
              id="edit-nombre"
              maxLength={100}
              value={editForm.nombre}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, nombre: event.target.value }))
              }
              className={fieldClass}
              placeholder="Relámpago"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="edit-raza" label="Raza">
              <input
                id="edit-raza"
                maxLength={50}
                value={editForm.raza}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, raza: event.target.value }))
                }
                className={fieldClass}
                placeholder="Angus"
              />
            </Field>
            <Field id="edit-color" label="Color">
              <input
                id="edit-color"
                maxLength={20}
                value={editForm.color}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, color: event.target.value }))
                }
                className={fieldClass}
                placeholder="Negro"
              />
            </Field>
          </div>
          <Field id="edit-estado" label="Estado">
            <select
              id="edit-estado"
              required
              disabled={['VENDIDO', 'BAJA'].includes(editForm.estado)}
              value={editForm.estado}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  estado: event.target.value as BovineStatus,
                }))
              }
              className={fieldClass}
            >
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              {['VENDIDO', 'BAJA'].includes(editForm.estado) ? <option value={editForm.estado}>{bovineStatusLabel(editForm.estado)}</option> : null}
            </select>
          </Field>
          {editError ? (
            <p className="text-sm text-red-600" role="alert">
              {editError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover disabled:opacity-70"
          >
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Registrar aplicación"
        description="Se guarda en este dispositivo y se confirma en la finca al sincronizar."
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
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium ${active
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

// RF-UC07-02: presenta próximas aplicaciones y vencimientos del hato junto a su historial.
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
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
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

// Presenta un filtro y resalta la opción seleccionada.
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
      className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-bovi text-white' : 'bg-white text-stone-600'
        }`}
    >
      {label}
    </button>
  )
}
