import { useState, type FormEvent } from 'react'
import { Field, Modal, fieldClass } from './Modal.tsx'

type CreateFarmModalProps = {
  open: boolean
  onClose: () => void
  onCreate: (nombre: string, ubicacion: string) => Promise<void>
}

export function CreateFarmModal({
  open,
  onClose,
  onCreate,
}: CreateFarmModalProps) {
  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onCreate(nombre.trim(), ubicacion.trim())
      setNombre('')
      setUbicacion('')
      onClose()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo crear la finca. Inténtalo de nuevo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear nueva finca"
      description="Solo necesitamos el nombre y la región para dejarla activa."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="farm-name" label="Nombre de la finca">
          <input
            id="farm-name"
            required
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className={fieldClass}
            placeholder="Finca El Roble"
          />
        </Field>
        <Field id="farm-location" label="Ubicación / Región">
          <input
            id="farm-location"
            required
            value={ubicacion}
            onChange={(event) => setUbicacion(event.target.value)}
            className={fieldClass}
            placeholder="Los Lagos, Chile"
          />
        </Field>
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
          {submitting ? 'Creando…' : 'Crear y seleccionar'}
        </button>
      </form>
    </Modal>
  )
}
