import {
  Check,
  ChevronDown,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Power,
  ShieldCheck,
  Tractor,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import { roleLabel } from '../lib/dashboard.ts'
import {
  addFarmMember,
  loadFarmMembers,
  loadRoles,
  removeFarmMember,
} from '../lib/farm-manage.ts'
import type { FarmMember } from '../types/dashboard.ts'

export default function FarmManagePage() {
  const { activeFarm, role, updateActiveFarm } = useFarm()

  const [toast, setToast] = useState<{
    message: string
    tone: 'ok' | 'warn' | 'error'
  } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!activeFarm) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10 text-center">
        <Tractor className="mx-auto mb-3 size-10 text-stone-300" />
        <p className="font-serif text-xl font-semibold text-stone-700">
          Sin finca activa
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Selecciona una finca desde el inicio para gestionarla.
        </p>
      </div>
    )
  }

  if (role !== 'admin') {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10 text-center">
        <ShieldCheck className="mx-auto mb-3 size-10 text-stone-300" />
        <p className="font-serif text-xl font-semibold text-stone-700">
          Acceso restringido
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Solo los administradores de la finca pueden gestionar esta sección.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <header className="mb-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
          FINCA ACTIVA
        </p>
        <h1 className="font-serif text-3xl font-semibold text-stone-900">
          Gestionar finca
        </h1>
      </header>

      <div className="space-y-5">
        {/* Informacion de la finca seleccionada*/}
        <InfoSection
          farmId={activeFarm.id}
          initialNombre={activeFarm.nombre}
          initialUbicacion={activeFarm.ubicacion ?? ''}
          onSave={updateActiveFarm}
          onToast={setToast}
        />

        {/* Estado de la finca seleccionada*/}
        <StatusSection
          activo={activeFarm.activo}
          onToggle={updateActiveFarm}
          onToast={setToast}
        />

        {/* Seccion de los miembros asociados */}
        <MembersSection
          farmId={activeFarm.id}
          currentUserId={undefined}
          onToast={setToast}
        />
      </div>
    </div>
  )
}


function InfoSection({
  initialNombre,
  initialUbicacion,
  onSave,
  onToast,
}: {
  farmId: string
  initialNombre: string
  initialUbicacion: string
  onSave: (patch: { nombre?: string; ubicacion?: string }) => Promise<unknown>
  onToast: (t: { message: string; tone: 'ok' | 'warn' | 'error' }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [nombre, setNombre] = useState(initialNombre)
  const [ubicacion, setUbicacion] = useState(initialUbicacion)
  const [saving, setSaving] = useState(false)
  const nombreRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    if (!editing) {
      setNombre(initialNombre)
      setUbicacion(initialUbicacion)
    }
  }, [initialNombre, initialUbicacion, editing])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim() || undefined,
      })
      setEditing(false)
      onToast({ message: 'Información de la finca actualizada', tone: 'ok' })
    } catch (err) {
      onToast({
        message:
          err instanceof Error ? err.message : 'No se pudo guardar. Inténtalo de nuevo.',
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleEdit() {
    setEditing(true)
    setTimeout(() => nombreRef.current?.focus(), 50)
  }

  function handleCancel() {
    setNombre(initialNombre)
    setUbicacion(initialUbicacion)
    setEditing(false)
  }

  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pencil className="size-4 text-bovi" />
          <h2 className="font-serif text-xl font-semibold text-stone-900">
            Información
          </h2>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={handleEdit}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-bovi transition hover:bg-bovi/10"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="farm-nombre" className="text-sm font-medium text-stone-800">
              Nombre de la finca
            </label>
            <input
              ref={nombreRef}
              id="farm-nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={fieldClass}
              placeholder="Finca El Roble"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="farm-ubicacion" className="text-sm font-medium text-stone-800">
              Ubicación / Región
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input
                id="farm-ubicacion"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                className={`${fieldClass} pl-9`}
                placeholder="Los Lagos, Chile"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover disabled:opacity-70"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-200 bg-cream px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <X className="size-4" />
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <InfoRow label="Nombre" value={nombre || '—'} />
          <InfoRow
            label="Ubicación"
            value={ubicacion || 'No especificada'}
            muted={!ubicacion}
          />
        </div>
      )}
    </section>
  )
}

function InfoRow({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-start justify-between rounded-xl bg-cream px-3 py-3 gap-3">
      <span className="text-xs font-medium text-stone-400 pt-0.5 shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${muted ? 'text-stone-400' : 'text-stone-800'}`}>
        {value}
      </span>
    </div>
  )
}


function StatusSection({
  activo,
  onToggle,
  onToast,
}: {
  activo: boolean
  onToggle: (patch: { activo: boolean }) => Promise<unknown>
  onToast: (t: { message: string; tone: 'ok' | 'warn' | 'error' }) => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleToggle() {
    setSaving(true)
    try {
      await onToggle({ activo: !activo })
      onToast({
        message: activo ? 'Finca marcada como inactiva' : 'Finca marcada como activa',
        tone: activo ? 'warn' : 'ok',
      })
    } catch (err) {
      onToast({
        message:
          err instanceof Error ? err.message : 'No se pudo cambiar el estado.',
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Power className="size-4 text-bovi" />
        <h2 className="font-serif text-xl font-semibold text-stone-900">
          Estado de la finca
        </h2>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-cream px-4 py-4">
        <div>
          <p className="text-sm font-medium text-stone-800">
            {activo ? 'Activa' : 'Inactiva'}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {activo
              ? 'La finca está operando normalmente.'
              : 'La finca está pausada. Los datos se conservan.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          aria-pressed={activo}
          className={`relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full border-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-bovi/50 disabled:opacity-60 ${activo ? 'bg-bovi border-bovi' : 'bg-stone-300 border-stone-300'
            }`}
        >
          <span className="sr-only">{activo ? 'Desactivar' : 'Activar'} finca</span>
          {saving ? (
            <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-white" />
          ) : (
            <span
              className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${activo ? 'translate-x-5' : 'translate-x-0.5'
                }`}
            />
          )}
        </button>
      </div>
    </section>
  )
}


function MembersSection({
  farmId,
  currentUserId,
  onToast,
}: {
  farmId: string
  currentUserId: string | undefined
  onToast: (t: { message: string; tone: 'ok' | 'warn' | 'error' }) => void
}) {
  const [members, setMembers] = useState<FarmMember[]>([])
  const [roles, setRoles] = useState<{ id: string; nombre: string }[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)


  const [addEmail, setAddEmail] = useState('')
  const [addRoleId, setAddRoleId] = useState('')
  const [adding, setAdding] = useState(false)


  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoadingMembers(true)

    async function load() {
      try {
        const [fetchedMembers, fetchedRoles] = await Promise.all([
          loadFarmMembers(farmId),
          loadRoles(),
        ])
        if (!active) return
        setMembers(fetchedMembers)
        setRoles(fetchedRoles)
        if (fetchedRoles[0] && !addRoleId) {
          setAddRoleId(fetchedRoles[0].id)
        }
      } catch {
        if (!active) return
        onToast({ message: 'No se pudo cargar el equipo.', tone: 'error' })
      } finally {
        if (active) setLoadingMembers(false)
      }
    }

    void load()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!addRoleId) return
    setAdding(true)
    try {
      await addFarmMember(farmId, addEmail.trim().toLowerCase(), addRoleId)
      // Reload members list
      const updated = await loadFarmMembers(farmId)
      setMembers(updated)
      setAddEmail('')
      onToast({ message: `Usuario agregado correctamente`, tone: 'ok' })
    } catch (err) {
      onToast({
        message:
          err instanceof Error ? err.message : 'No se pudo agregar el usuario.',
        tone: 'error',
      })
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(member: FarmMember) {
    setRemovingId(member.userId)
    try {
      await removeFarmMember(farmId, member.userId)
      setMembers((current) => current.filter((m) => m.userId !== member.userId))
      onToast({ message: `${member.email} eliminado del equipo`, tone: 'warn' })
    } catch (err) {
      onToast({
        message:
          err instanceof Error ? err.message : 'No se pudo eliminar al usuario.',
        tone: 'error',
      })
    } finally {
      setRemovingId(null)
    }
  }

  const adminRoleId = roles.find((r) => !r.nombre.toLowerCase().includes('campo'))?.id
  const campoRoleId = roles.find((r) => r.nombre.toLowerCase().includes('campo'))?.id

  return (
    <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users className="size-4 text-bovi" />
        <h2 className="font-serif text-xl font-semibold text-stone-900">
          Equipo de trabajo
        </h2>
      </div>


      {loadingMembers ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-6 animate-spin text-stone-400" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-stone-400 mb-4">No hay usuarios asignados aún.</p>
      ) : (
        <ul className="space-y-2 mb-5">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId
            const isRemoving = removingId === member.userId
            return (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {member.nombre ?? member.email}
                  </p>
                  {member.nombre && (
                    <p className="truncate text-xs text-stone-500">{member.email}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RoleBadge role={member.role} adminRoleId={adminRoleId} campoRoleId={campoRoleId} roleId={member.roleId} />
                  {!isCurrentUser && (
                    <button
                      type="button"
                      disabled={isRemoving}
                      onClick={() => handleRemove(member)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label={`Eliminar a ${member.email}`}
                    >
                      {isRemoving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}


      <div className="border-t border-stone-100 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="size-4 text-bovi" />
          <p className="text-sm font-semibold text-stone-800">Agregar usuario</p>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          El usuario debe estar registrado en BoviTrack.
        </p>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              type="email"
              required
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className={`${fieldClass} pl-9`}
              id="add-member-email"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-role-select" className="text-sm font-medium text-stone-800">
              Rol
            </label>
            <div className="relative">
              <select
                id="add-role-select"
                value={addRoleId}
                onChange={(e) => setAddRoleId(e.target.value)}
                className={`${fieldClass} appearance-none pr-10`}
                required
              >
                {roles.map((r) => {
                  const mappedRole = r.nombre.toLowerCase().includes('campo') ? 'campo' : 'admin'
                  return (
                    <option key={r.id} value={r.id}>
                      {roleLabel(mappedRole)}
                    </option>
                  )
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={adding || !addRoleId}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover disabled:opacity-70"
          >
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {adding ? 'Agregando…' : 'Agregar al equipo'}
          </button>
        </form>
      </div>
    </section>
  )
}

function RoleBadge({
  role,
  adminRoleId,
  campoRoleId,
  roleId,
}: {
  role: 'admin' | 'campo'
  adminRoleId: string | undefined
  campoRoleId: string | undefined
  roleId: string
}) {
  const isAdmin = role === 'admin' || roleId === adminRoleId
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isAdmin ? 'bg-bovi/10 text-bovi' : 'bg-amber-100 text-amber-800'
        }`}
    >
      {isAdmin ? (
        <ShieldCheck className="size-3" />
      ) : (
        <Tractor className="size-3" />
      )}
      {isAdmin ? 'Admin' : 'Campo'}
    </span>
  )
}
