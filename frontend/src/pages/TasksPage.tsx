import { ClipboardList, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { Field, Modal, fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import { roleLabel, todayIso } from '../lib/dashboard.ts'
import { loadFarmMembers } from '../lib/farm-manage.ts'
import type { FarmMember } from '../types/dashboard.ts'

type LocalTask = {
  id: string
  titulo: string
  descripcion: string
  estado: 'PENDIENTE' | 'COMPLETADA'
  fecha_limite: string
  asignadaA: string | null
  asignadaNombre: string
}

const emptyForm = {
  titulo: '',
  descripcion: '',
  asignadaA: '',
  fecha_limite: todayIso(),
}

export default function TasksPage() {
  const { user } = useAuth()
  const { activeFarm, role, loading } = useFarm()
  const [members, setMembers] = useState<FarmMember[]>([])
  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [scope, setScope] = useState<'mias' | 'equipo'>('mias')
  const [status, setStatus] = useState<'pendientes' | 'hechas' | 'todas'>('pendientes')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState<string | null>(null)

  const displayName =
    (typeof user?.user_metadata.nombre_completo === 'string' &&
      user.user_metadata.nombre_completo) ||
    user?.email ||
    'Tú'

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setTasks([])
    setMembers([])
    setScope('mias')
  }, [activeFarm?.id])

  useEffect(() => {
    if (!activeFarm) return
    const farmId = activeFarm.id
    let active = true
    loadFarmMembers(farmId)
      .then((rows) => {
        if (active) setMembers(rows)
      })
      .catch(() => {
        if (active) setMembers([])
      })
    return () => {
      active = false
    }
  }, [activeFarm])

  const people = useMemo(() => {
    const list = [...members]
    if (user && !list.some((item) => item.userId === user.id)) {
      list.unshift({
        userId: user.id,
        email: user.email ?? '',
        nombre: displayName,
        role,
        roleId: '',
      })
    }
    return list
  }, [displayName, members, role, user])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return tasks
      .filter((task) => {
        if (scope === 'mias') {
          const mine = !task.asignadaA || task.asignadaA === user?.id
          if (!mine) return false
        }
        if (status === 'pendientes' && task.estado !== 'PENDIENTE') return false
        if (status === 'hechas' && task.estado !== 'COMPLETADA') return false
        if (!term) return true
        return [task.titulo, task.descripcion, task.asignadaNombre]
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite) || a.titulo.localeCompare(b.titulo))
  }, [query, scope, status, tasks, user?.id])

  const mineCount = tasks.filter(
    (task) =>
      task.estado === 'PENDIENTE' && (!task.asignadaA || task.asignadaA === user?.id),
  ).length

  function update(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const assignee = people.find((item) => item.userId === form.asignadaA)
    const task: LocalTask = {
      id: crypto.randomUUID(),
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      estado: 'PENDIENTE',
      fecha_limite: form.fecha_limite,
      asignadaA: assignee?.userId ?? null,
      asignadaNombre: assignee ? memberLabel(assignee) : 'Toda la finca',
    }
    setTasks((current) => [task, ...current])
    setOpen(false)
    setForm({ ...emptyForm, fecha_limite: todayIso() })
    if (assignee && assignee.userId !== user?.id) {
      setScope('equipo')
    } else {
      setScope('mias')
    }
    setStatus('pendientes')
    setToast(
      assignee && assignee.userId !== user?.id
        ? `Vista previa. Quedó asignada a ${memberLabel(assignee)} y aún no se guarda.`
        : 'Vista previa. La tarea quedó en esta sesión y aún no se guarda.',
    )
  }

  function toggle(task: LocalTask) {
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              estado: item.estado === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA',
            }
          : item,
      ),
    )
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 pt-10 text-sm text-stone-500">Cargando…</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast} tone="warn" /> : null}

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
            CAMPO
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            Tareas
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {activeFarm
              ? `Asigna trabajo en ${activeFarm.nombre} y revisa lo que te toca. Aún no se guarda.`
              : 'Selecciona una finca desde Inicio para ver las tareas.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({
              ...emptyForm,
              fecha_limite: todayIso(),
              asignadaA: user?.id ?? '',
            })
            setOpen(true)
          }}
          disabled={!activeFarm}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-bovi px-3 text-sm font-medium text-white transition hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="size-4" />
          Asignar
        </button>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-stone-200/60 p-1">
        <SegmentButton
          active={scope === 'mias'}
          onClick={() => setScope('mias')}
          label={`Mis tareas${mineCount ? ` · ${mineCount}` : ''}`}
        />
        <SegmentButton
          active={scope === 'equipo'}
          onClick={() => setScope('equipo')}
          label="Del equipo"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ['pendientes', 'Pendientes'],
            ['hechas', 'Hechas'],
            ['todas', 'Todas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === value ? 'bg-bovi text-white' : 'bg-white text-stone-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-stone-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${fieldClass} pl-10`}
          placeholder="Buscar por título, detalle o persona"
        />
      </div>

      {visible.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
          <ClipboardList className="mx-auto size-10 text-stone-300" />
          <p className="mt-3 font-serif text-xl font-semibold text-stone-800">
            {scope === 'mias' ? 'No tienes tareas en esta vista' : 'El equipo no tiene tareas aquí'}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Usa Asignar para encargar una tarea a alguien de la finca. Quien la recibe la ve en Mis tareas.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {visible.map((task) => {
            const done = task.estado === 'COMPLETADA'
            const overdue = !done && task.fecha_limite < todayIso()
            return (
              <li
                key={task.id}
                className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm"
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(task)}
                    className="mt-1 size-5 accent-bovi"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span
                        className={`text-sm font-medium ${
                          done ? 'text-stone-400 line-through' : 'text-stone-900'
                        }`}
                      >
                        {task.titulo}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          overdue
                            ? 'bg-red-100 text-red-800'
                            : done
                              ? 'bg-stone-100 text-stone-500'
                              : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {done ? 'Hecha' : overdue ? 'Vencida' : formatIso(task.fecha_limite)}
                      </span>
                    </span>
                    {task.descripcion ? (
                      <span className="mt-1 block text-xs text-stone-500">
                        {task.descripcion}
                      </span>
                    ) : null}
                    <span className="mt-2 block text-xs text-stone-500">
                      {task.asignadaNombre}
                      {done || overdue ? ` · ${formatIso(task.fecha_limite)}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Asignar tarea"
        description="La persona elegida la verá en Mis tareas. Aún no se guarda en la finca."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field id="tarea-titulo" label="Tarea">
            <input
              id="tarea-titulo"
              required
              maxLength={120}
              value={form.titulo}
              onChange={(event) => update('titulo', event.target.value)}
              className={fieldClass}
              placeholder="Vacunar el lote norte"
            />
          </Field>
          <Field id="tarea-detalle" label="Detalle (opcional)">
            <textarea
              id="tarea-detalle"
              rows={3}
              maxLength={240}
              value={form.descripcion}
              onChange={(event) => update('descripcion', event.target.value)}
              className={`${fieldClass} resize-none`}
              placeholder="Qué hay que hacer y con qué insumo"
            />
          </Field>
          <Field id="tarea-persona" label="Asignar a">
            <select
              id="tarea-persona"
              value={form.asignadaA}
              onChange={(event) => update('asignadaA', event.target.value)}
              className={fieldClass}
            >
              <option value="">Toda la finca</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {memberLabel(person)} · {roleLabel(person.role)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="tarea-fecha" label="Fecha límite">
            <input
              id="tarea-fecha"
              type="date"
              required
              value={form.fecha_limite}
              onChange={(event) => update('fecha_limite', event.target.value)}
              className={fieldClass}
            />
          </Field>
          <button
            type="submit"
            className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover"
          >
            Asignar tarea
          </button>
        </form>
      </Modal>
    </div>
  )
}

function memberLabel(member: Pick<FarmMember, 'nombre' | 'email'>) {
  const name = member.nombre?.trim()
  return name || member.email
}

function formatIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
  })
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
      className={`min-h-11 cursor-pointer rounded-xl px-2 text-sm font-medium ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
      }`}
    >
      {label}
    </button>
  )
}
