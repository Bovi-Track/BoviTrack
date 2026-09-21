import { Plus, Warehouse } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Field, Modal, fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import { todayIso } from '../lib/dashboard.ts'

const emptyForm = {
  nombre: '',
  categoria: 'CONCENTRADO',
  cantidad: '',
  unidad: 'kg',
  ubicacion: '',
  fecha: todayIso(),
  observaciones: '',
}

const categories = [
  { value: 'CONCENTRADO', label: 'Concentrado' },
  { value: 'MINERAL', label: 'Sal / mineral' },
  { value: 'MEDICAMENTO', label: 'Medicamento' },
  { value: 'VACUNA', label: 'Vacuna' },
  { value: 'HERRAMIENTA', label: 'Herramienta' },
  { value: 'OTRO', label: 'Otro' },
]

export default function InventoryPage() {
  const { activeFarm, loading } = useFarm()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  function update(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    setForm({ ...emptyForm, fecha: todayIso() })
    setToast('Interfaz lista. El inventario de bodega se habilitará pronto.')
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
            BODEGA
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            Inventario
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {activeFarm
              ? `Insumos y movimientos de ${activeFarm.nombre}`
              : 'Selecciona una finca desde Inicio para gestionar la bodega.'}
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

      <section className="rounded-3xl border border-dashed border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
        <Warehouse className="mx-auto size-10 text-stone-300" />
        <p className="mt-3 font-serif text-xl font-semibold text-stone-800">
          Bodega vacía
        </p>
        <p className="mt-1 text-sm text-stone-500">
          El listado de existencias llegará cuando se habilite el guardado.
          Puedes revisar el formulario de alta desde Agregar.
        </p>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Agregar insumo"
        description="Vista previa del formulario. El movimiento aún no se guarda."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field id="insumo-nombre" label="Nombre del insumo">
            <input
              id="insumo-nombre"
              required
              maxLength={100}
              value={form.nombre}
              onChange={(event) => update('nombre', event.target.value)}
              className={fieldClass}
              placeholder="Concentrado 16%"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="insumo-cat" label="Categoría">
              <select
                id="insumo-cat"
                required
                value={form.categoria}
                onChange={(event) => update('categoria', event.target.value)}
                className={fieldClass}
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="insumo-fecha" label="Fecha">
              <input
                id="insumo-fecha"
                type="date"
                required
                value={form.fecha}
                onChange={(event) => update('fecha', event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field id="insumo-cant" label="Cantidad">
              <input
                id="insumo-cant"
                type="number"
                min={0}
                step="0.01"
                required
                value={form.cantidad}
                onChange={(event) => update('cantidad', event.target.value)}
                className={fieldClass}
                placeholder="50"
              />
            </Field>
            <Field id="insumo-unidad" label="Unidad">
              <select
                id="insumo-unidad"
                required
                value={form.unidad}
                onChange={(event) => update('unidad', event.target.value)}
                className={fieldClass}
              >
                <option value="kg">kg</option>
                <option value="qq">qq</option>
                <option value="L">L</option>
                <option value="und">unidades</option>
                <option value="dosis">dosis</option>
              </select>
            </Field>
          </div>
          <Field id="insumo-ubi" label="Ubicación en bodega (opcional)">
            <input
              id="insumo-ubi"
              maxLength={80}
              value={form.ubicacion}
              onChange={(event) => update('ubicacion', event.target.value)}
              className={fieldClass}
              placeholder="Estante A · Bodega principal"
            />
          </Field>
          <Field id="insumo-obs" label="Observaciones (opcional)">
            <textarea
              id="insumo-obs"
              rows={3}
              maxLength={200}
              value={form.observaciones}
              onChange={(event) => update('observaciones', event.target.value)}
              className={`${fieldClass} resize-none`}
              placeholder="Lote, vencimiento o proveedor"
            />
          </Field>
          <button
            type="submit"
            className="min-h-12 w-full cursor-pointer rounded-xl bg-bovi text-sm font-medium text-white transition hover:bg-bovi-hover"
          >
            Guardar insumo
          </button>
        </form>
      </Modal>
    </div>
  )
}
