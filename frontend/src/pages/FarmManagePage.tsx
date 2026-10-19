import { MembersSection } from '../components/farms/MembersSection.tsx'
import { BovineMovementHistory } from '../components/bovines/BovineMovementHistory.tsx'
import {
  Check,
  ChevronDown,
  Loader2,
  MapPin,
  Pencil,
  Power,
  ShieldCheck,
  Tractor,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useAuth } from '../auth/useAuth.ts'
import { useFarm } from '../context/useFarm.ts'

// Expone los mensajes de error de Supabase, que pueden no ser instancias de Error.
function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (
    typeof error === 'object' && error !== null && 'message' in error &&
    typeof error.message === 'string'
  ) return error.message
  return fallback
}

// RF-UC03-01/02 y RF-UC15-02: coordina datos, miembros e historial de movimientos de la finca.
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
          key={`${activeFarm.id}:info`}
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
          key={`${activeFarm.id}:members`}
          farmId={activeFarm.id}
          currentUserId={user?.id}
          onToast={setToast}
        />
        <BovineMovementHistory key={`${activeFarm.id}:movimientos`} farmId={activeFarm.id} />
      </div>
    </div>
  )
}

// Presenta las fincas administradas y permite cambiar la selección de trabajo.
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
    // Cierra el selector de finca cuando el usuario pulsa fuera de su contenedor.
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

// RF-UC03-01: presenta y permite editar nombre y ubicación de la finca.
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

  // RF-UC03-01: guarda nombre y ubicación de la finca mediante el contexto compartido.
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
        message: getErrorMessage(err, 'No se pudo guardar. Inténtalo de nuevo.'),
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Copia los datos actuales para iniciar la edición de la finca.
  function handleEdit() {
    setEditing(true)
    setTimeout(() => nombreRef.current?.focus(), 50)
  }

  // Cancela la edición y restaura los valores persistidos de la finca.
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

// Presenta una propiedad de la finca con su icono y contenido.
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

// RF-UC03-01: permite activar o desactivar la finca seleccionada.
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

  // RF-UC03-01: solicita cambiar el estado activo de la finca y confirma el resultado.
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
        message: getErrorMessage(err, 'No se pudo cambiar el estado.'),
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
