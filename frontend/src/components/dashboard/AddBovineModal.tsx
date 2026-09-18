import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { todayIso } from '../../lib/dashboard.ts'
import { Field, Modal, fieldClass } from './Modal.tsx'

type AddBovineModalProps = {
  open: boolean
  farmName: string
  onClose: () => void
  onCreate: (payload: {
    numero_diio: string
    identificador_interno: string
    nombre: string | null
    raza: string | null
    color: string | null
    sexo: 'MACHO' | 'HEMBRA'
    fecha_nacimiento: string | null
    fecha_ingreso: string
  }) => Promise<void>
}

const emptyForm = {
  numero_diio: '',
  identificador_interno: '',
  nombre: '',
  raza: '',
  color: '',
  sexo: 'MACHO' as const,
  fecha_nacimiento: '',
  fecha_ingreso: todayIso(),
}

export function AddBovineModal({
  open,
  farmName,
  onClose,
  onCreate,
}: AddBovineModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onCreate({
        numero_diio: form.numero_diio.trim(),
        identificador_interno: form.identificador_interno.trim(),
        nombre: form.nombre.trim() || null,
        raza: form.raza.trim() || null,
        color: form.color.trim() || null,
        sexo: form.sexo as 'MACHO' | 'HEMBRA',
        fecha_nacimiento: form.fecha_nacimiento || null,
        fecha_ingreso: form.fecha_ingreso,
      })
      setForm({ ...emptyForm, fecha_ingreso: todayIso() })
      onClose()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo guardar el bovino.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar bovino"
      description={
        <>
          Se registrará en {farmName}. El ID se genera solo. Si deseas registrar una compra, ve a{' '}
          <Link
            to="/compras"
            onClick={onClose}
            className="font-medium text-bovi underline underline-offset-2"
          >
            compras
          </Link>.
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="diio" label="Número DIIO-SENASA">
            <input
              id="diio"
              required
              maxLength={50}
              value={form.numero_diio}
              onChange={(event) => update('numero_diio', event.target.value)}
              className={fieldClass}
              placeholder="CL-000123"
            />
          </Field>
          <Field id="interno" label="Identificador interno">
            <input
              id="interno"
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
          <Field id="nombre" label="Nombre (opcional)">
            <input
              id="nombre"
              maxLength={100}
              value={form.nombre}
              onChange={(event) => update('nombre', event.target.value)}
              className={fieldClass}
              placeholder="Relámpago"
            />
          </Field>
          <Field id="sexo" label="Sexo">
            <select
              id="sexo"
              required
              value={form.sexo}
              onChange={(event) => update('sexo', event.target.value)}
              className={fieldClass}
            >
              <option value="MACHO">Macho</option>
              <option value="HEMBRA">Hembra</option>
            </select>
          </Field>
          <Field id="raza" label="Raza (opcional)">
            <input
              id="raza"
              maxLength={50}
              value={form.raza}
              onChange={(event) => update('raza', event.target.value)}
              className={fieldClass}
              placeholder="Angus"
            />
          </Field>
          <Field id="color" label="Color (opcional)">
            <input
              id="color"
              maxLength={20}
              value={form.color}
              onChange={(event) => update('color', event.target.value)}
              className={fieldClass}
              placeholder="Negro"
            />
          </Field>
          <Field id="nacimiento" label="Fecha de nacimiento">
            <input
              id="nacimiento"
              type="date"
              value={form.fecha_nacimiento}
              onChange={(event) =>
                update('fecha_nacimiento', event.target.value)
              }
              className={fieldClass}
            />
          </Field>
          <Field id="ingreso" label="Fecha de ingreso">
            <input
              id="ingreso"
              type="date"
              required
              value={form.fecha_ingreso}
              onChange={(event) => update('fecha_ingreso', event.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover disabled:opacity-70"
        >
          {submitting ? 'Guardando…' : 'Guardar bovino'}
        </button>
      </form>
    </Modal>
  )
}
