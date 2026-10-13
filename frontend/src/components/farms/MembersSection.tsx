import {
  ChevronDown,
  ClipboardCheck,
  Link2,
  Loader2,
  Mail,
  ShieldCheck,
  Tractor,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { fieldClass } from '../dashboard/Modal.tsx'
import {
  addFarmMember,
  createFarmInvitation,
  loadFarmMembers,
  loadRoles,
  removeFarmMember,
  mapRole,
  roleLabel,
} from '../../lib/farms.ts'
import type { FarmMember } from '../../types/dashboard.ts'

// RF-UC15-01 y RF-UC15-02 (parcial): gestiona asociaciones de personal, roles e invitaciones.
export function MembersSection({
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

    // Carga miembros y roles, manejando por separado los resultados de ambas consultas.
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

  // RF-UC15-01 y RF-UC15-02 (parcial): agrega una cuenta existente con el rol elegido.
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

  // RF-UC15-01 (parcial): retira el acceso del miembro a esta finca.
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

  // RF-UC15-02: genera el enlace de invitación con el rol seleccionado.
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

  // Copia el enlace generado al portapapeles y confirma visualmente la acción.
  async function handleCopyLink() {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

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
                          {roleOptionLabel(r.nombre)}
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
                          {roleOptionLabel(r.nombre)}
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

// Presenta el rol explícito del miembro sin convertir un rol desconocido en administrador.
function RoleBadge({
  role,
}: {
  role: FarmMember['role']
}) {
  const isAdmin = role === 'admin'
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
      {roleLabel(role)}
    </span>
  )
}

// Normaliza las etiquetas de roles conocidos y conserva los nombres no reconocidos.
function roleOptionLabel(name: string) {
  const role = mapRole(name)
  return role === 'unknown' ? name : roleLabel(role)
}
