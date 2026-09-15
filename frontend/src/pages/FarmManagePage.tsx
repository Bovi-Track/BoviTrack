import {
  Check,
  ChevronDown,
  ClipboardCheck,
  Link2,
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
import { useAuth } from '../auth/AuthProvider.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import {
  addFarmMember,
  createFarmInvitation,
  loadFarmMembers,
  loadRoles,
  removeFarmMember,
} from '../lib/farm-manage.ts'
import type { FarmMember } from '../types/dashboard.ts'

export default function FarmManagePage() {
  const { activeFarm, farms, rolesByFarm, role, setActiveFarmId, updateActiveFarm } = useFarm()
  const { user } = useAuth()

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
          Solo los administradores de la finca pueden gestionar esta seccion.
        </p>
      </div>
    )
  }

  // Solo fincas donde el usuario actual es admin
  const adminFarms = farms.filter((f) => rolesByFarm[f.id] === 'admin')

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <header className="mb-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">
          FINCA ACTIVA
        </p>
        <FarmSelectorDropdown
          farms={adminFarms}
          activeFarmId={activeFarm.id}
          onSelect={setActiveFarmId}
        />
      </header>

      <div className="space-y-5">
        {/* Informacion de la finca seleccionada*/}
        <InfoSection
          key={activeFarm.id}
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
          key={activeFarm.id}
          farmId={activeFarm.id}
          currentUserId={user?.id}
          onToast={setToast}
        />
      </div>
    </div>
  )
}


// FarmSelectorDropdown
function FarmSelectorDropdown({
  farms,
  activeFarmId,
  onSelect,
}: {
  farms: { id: string; nombre: string; ubicacion: string | null }[]
  activeFarmId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeFarm = farms.find((f) => f.id === activeFarmId)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (farms.length <= 1) {
    return (
      <h1 className="font-serif text-3xl font-semibold text-stone-900">
        {activeFarm?.nombre ?? 'Gestionar finca'}
      </h1>
    )
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        id="farm-selector-btn"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-xl py-1 pr-2 -ml-1 pl-1 text-left transition hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-bovi/40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <h1 className="font-serif text-3xl font-semibold text-stone-900 leading-tight">
          {activeFarm?.nombre ?? 'Gestionar finca'}
        </h1>
        <ChevronDown
          className={`size-5 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-stone-400 uppercase">
            Tus fincas
          </p>
          <ul className="p-1.5 space-y-0.5">
            {farms.map((farm) => {
              const isActive = farm.id === activeFarmId
              return (
                <li key={farm.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onSelect(farm.id)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${isActive
                      ? 'bg-bovi/10 text-bovi'
                      : 'text-stone-700 hover:bg-stone-50'
                      }`}
                  >
                    <Tractor className="size-4 shrink-0 opacity-70" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{farm.nombre}</p>
                      {farm.ubicacion && (
                        <p className="truncate text-[11px] opacity-60">{farm.ubicacion}</p>
                      )}
                    </div>
                    {isActive && <Check className="ml-auto size-4 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// InfoSection
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim() || undefined,
      })
      setEditing(false)
      onToast({ message: 'Informacion de la finca actualizada', tone: 'ok' })
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


// MembersSection
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

  // Tabs: 'email' | 'link'
  const [inviteTab, setInviteTab] = useState<'email' | 'link'>('email')

  // Link invitation state
  const [linkRoleId, setLinkRoleId] = useState('')
  const [generatingLink, setGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [membersRes, rolesRes] = await Promise.allSettled([
          loadFarmMembers(farmId),
          loadRoles(),
        ])
        if (!active) return

        if (rolesRes.status === 'fulfilled') {
          const fetchedRoles = rolesRes.value
          setRoles(fetchedRoles)
          if (fetchedRoles[0] && !addRoleId) {
            setAddRoleId(fetchedRoles[0].id)
            setLinkRoleId(fetchedRoles[0].id)
          }
        } else {
          console.error('Error al cargar roles:', rolesRes.reason)
        }

        if (membersRes.status === 'fulfilled') {
          setMembers(membersRes.value)
        } else {
          console.error('Error al cargar miembros del equipo:', membersRes.reason)
          onToast({
            message:
              membersRes.reason instanceof Error
                ? membersRes.reason.message
                : 'No se pudo cargar el equipo.',
            tone: 'error',
          })
        }
      } catch (err) {
        if (!active) return
        console.error('Error general al cargar equipo o roles:', err)
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
      const updated = await loadFarmMembers(farmId)
      setMembers(updated)
      setAddEmail('')
      onToast({ message: 'Usuario agregado correctamente', tone: 'ok' })
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

  async function handleGenerateLink() {
    if (!linkRoleId) return
    setGeneratingLink(true)
    setGeneratedLink(null)
    setCopied(false)
    try {
      const token = await createFarmInvitation(farmId, linkRoleId)
      const link = `${window.location.origin}/unirse?token=${encodeURIComponent(token)}`
      setGeneratedLink(link)
    } catch (err) {
      onToast({
        message:
          err instanceof Error ? err.message : 'No se pudo generar el enlace.',
        tone: 'error',
      })
    } finally {
      setGeneratingLink(false)
    }
  }

  async function handleCopyLink() {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const adminRoleId = roles.find((r) => !r.nombre.toLowerCase().includes('campo'))?.id

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
        <p className="text-sm text-stone-400 mb-4">No hay usuarios asignados aun.</p>
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
                  <RoleBadge
                    role={member.role}
                    adminRoleId={adminRoleId}
                    roleId={member.roleId}
                    roleName={member.roleName}
                  />
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

      {/* ---- Agregar integrante ---- */}
      <div className="border-t border-stone-100 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="size-4 text-bovi" />
          <p className="text-sm font-semibold text-stone-800">Agregar integrante</p>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            id="invite-tab-email"
            onClick={() => { setInviteTab('email'); setGeneratedLink(null) }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${inviteTab === 'email'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            <Mail className="size-3.5" />
            Por correo
          </button>
          <button
            type="button"
            id="invite-tab-link"
            onClick={() => { setInviteTab('link'); setGeneratedLink(null) }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${inviteTab === 'link'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            <Link2 className="size-3.5" />
            Por enlace
          </button>
        </div>

        {inviteTab === 'email' && (
          <>
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
                    disabled={roles.length === 0}
                  >
                    {roles.length === 0 ? (
                      <option value="" disabled>
                        Cargando roles...
                      </option>
                    ) : (
                      roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))
                    )}
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
          </>
        )}

        {inviteTab === 'link' && (
          <>
            <p className="text-xs text-stone-500 mb-3">
              Genera un enlace unico. Cualquier persona con el enlace puede unirse a la finca.
              El enlace expira en <strong>7 dias</strong> y es de uso unico.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="link-role-select" className="text-sm font-medium text-stone-800">
                  Rol del invitado
                </label>
                <div className="relative">
                  <select
                    id="link-role-select"
                    value={linkRoleId}
                    onChange={(e) => { setLinkRoleId(e.target.value); setGeneratedLink(null) }}
                    className={`${fieldClass} appearance-none pr-10`}
                    disabled={roles.length === 0}
                  >
                    {roles.length === 0 ? (
                      <option value="" disabled>
                        Cargando roles...
                      </option>
                    ) : (
                      roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                </div>
              </div>

              {generatedLink ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-cream px-3 py-2.5">
                    <p className="flex-1 truncate text-xs text-stone-600 font-mono">
                      {generatedLink}
                    </p>
                  </div>
                  <button
                    type="button"
                    id="copy-invite-link-btn"
                    onClick={handleCopyLink}
                    className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${copied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-bovi text-white hover:bg-bovi-hover'
                      }`}
                  >
                    {copied ? (
                      <>
                        <ClipboardCheck className="size-4" />
                        ¡Enlace copiado!
                      </>
                    ) : (
                      <>
                        <Link2 className="size-4" />
                        Copiar enlace
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGeneratedLink(null); setCopied(false) }}
                    className="w-full text-center text-xs text-stone-400 hover:text-stone-600 transition py-1"
                  >
                    Generar nuevo enlace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="generate-invite-link-btn"
                  disabled={generatingLink || !linkRoleId}
                  onClick={handleGenerateLink}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover disabled:opacity-70"
                >
                  {generatingLink ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                  {generatingLink ? 'Generando…' : 'Generar enlace de invitacion'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function RoleBadge({
  role,
  adminRoleId,
  roleId,
  roleName,
}: {
  role: 'admin' | 'campo'
  adminRoleId: string | undefined
  roleId: string
  roleName?: string
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
      {roleName ?? (isAdmin ? 'Admin' : 'Campo')}
    </span>
  )
}