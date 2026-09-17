import { ArrowLeft, CheckCircle2, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Field, fieldClass } from '../components/dashboard/Modal.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import { todayIso } from '../lib/dashboard.ts'
import { calculatePurchasePreview, createPurchase } from '../lib/purchases.ts'
import type { Farm } from '../types/dashboard.ts'
import type { PurchaseBovineInput, PurchaseResult } from '../types/purchases.ts'

type PurchaseHeader = {
  id_subasta: string
  numero_factura: string
  fecha_compra: string
  costo_flete_total: string
  proveedor: string
}

type BovineDraft = {
  localId: string
  finca_id: string
  numero_diio: string
  identificador_interno: string
  nombre: string
  raza: string
  color: string
  sexo: string
  fecha_nacimiento: string
  fecha_ingreso: string
  peso_compra_kg: string
  precio_compra_kilo: string
}

type BovineField = Exclude<keyof BovineDraft, 'localId'>

const money = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function newHeader(): PurchaseHeader {
  return {
    id_subasta: '',
    numero_factura: '',
    fecha_compra: todayIso(),
    costo_flete_total: '0',
    proveedor: '',
  }
}

function newBovine(): BovineDraft {
  return {
    localId: crypto.randomUUID(),
    finca_id: '',
    numero_diio: '',
    identificador_interno: '',
    nombre: '',
    raza: '',
    color: '',
    sexo: 'MACHO',
    fecha_nacimiento: '',
    fecha_ingreso: todayIso(),
    peso_compra_kg: '',
    precio_compra_kilo: '',
  }
}

export default function PurchasesPage() {
  const { farms, rolesByFarm, activeFarm, loading } = useFarm()
  const [header, setHeader] = useState<PurchaseHeader>(newHeader)
  const [bovines, setBovines] = useState<BovineDraft[]>(() => [newBovine()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PurchaseResult | null>(null)

  const adminFarms = farms.filter(
    (farm) => farm.activo && rolesByFarm[farm.id] === 'admin',
  )
  const defaultFarmId = adminFarms.some((farm) => farm.id === activeFarm?.id)
    ? activeFarm?.id ?? ''
    : adminFarms[0]?.id ?? ''

  const preview = useMemo(
    () => calculatePurchasePreview(
      bovines.map((bovine) => ({
        peso_compra_kg: Number(bovine.peso_compra_kg || 0),
        precio_compra_kilo: Number(bovine.precio_compra_kilo || 0),
      })),
      Number(header.costo_flete_total || 0),
    ),
    [bovines, header.costo_flete_total],
  )

  function updateHeader(field: keyof PurchaseHeader, value: string) {
    setHeader((current) => ({ ...current, [field]: value }))
  }

  function updateBovine(localId: string, field: BovineField, value: string) {
    setBovines((current) => current.map((bovine) =>
      bovine.localId === localId ? { ...bovine, [field]: value } : bovine,
    ))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!header.id_subasta.trim() && !header.proveedor.trim()) {
      setError('Indica una subasta o un proveedor.')
      return
    }

    const selectedFarms = bovines.map((bovine) => bovine.finca_id || defaultFarmId)
    if (selectedFarms.some((id) => !adminFarms.some((farm) => farm.id === id))) {
      setError('Selecciona una finca administrada para cada bovino.')
      return
    }

    const diios = bovines.map((bovine) => bovine.numero_diio.trim())
    const internalIds = bovines.map((bovine) => bovine.identificador_interno.trim())
    if (new Set(diios).size !== diios.length || new Set(internalIds).size !== internalIds.length) {
      setError('Los números DIIO y los identificadores internos no pueden repetirse en la compra.')
      return
    }

    const purchaseBovines: PurchaseBovineInput[] = bovines.map((bovine, index) => ({
      finca_id: selectedFarms[index],
      numero_diio: bovine.numero_diio.trim(),
      identificador_interno: bovine.identificador_interno.trim(),
      nombre: bovine.nombre.trim() || null,
      raza: bovine.raza.trim() || null,
      color: bovine.color.trim() || null,
      sexo: bovine.sexo as PurchaseBovineInput['sexo'],
      fecha_nacimiento: bovine.fecha_nacimiento || null,
      fecha_ingreso: bovine.fecha_ingreso || null,
      peso_compra_kg: Number(bovine.peso_compra_kg),
      precio_compra_kilo: Number(bovine.precio_compra_kilo),
    }))

    setSubmitting(true)
    try {
      const saved = await createPurchase({
        id_subasta: header.id_subasta.trim() || null,
        numero_factura: header.numero_factura.trim(),
        fecha_compra: header.fecha_compra,
        costo_flete_total: Number(header.costo_flete_total || 0),
        proveedor: header.proveedor.trim() || null,
        bovinos: purchaseBovines,
      })
      setResult(saved)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar la compra.')
    } finally {
      setSubmitting(false)
    }
  }

  function startAgain() {
    setHeader(newHeader())
    setBovines([newBovine()])
    setResult(null)
    setError('')
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 pt-10 text-sm text-stone-500">Cargando fincas…</p>
  }

  if (adminFarms.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10 text-center">
        <ShoppingBag className="mx-auto mb-3 size-10 text-stone-300" />
        <h1 className="font-serif text-xl font-semibold text-stone-800">Sin finca administrada</h1>
        <p className="mt-1 text-sm text-stone-500">
          Para registrar compras necesitas administrar al menos una finca activa.
        </p>
        <Link to="/inicio" className="mt-5 inline-flex text-sm font-medium text-bovi underline underline-offset-2">
          Volver al inicio
        </Link>
      </div>
    )
  }

  if (result) {
    return <PurchaseSuccess result={result} farms={farms} onNew={startAgain} />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-10">
      <Link to="/inicio" className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-bovi">
        <ArrowLeft className="size-4" /> Volver al inicio
      </Link>

      <header className="mt-5 mb-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">COMPRAS DE GANADO</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">Registrar compra</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-500">
          Registra la factura y los bovinos adquiridos. Puedes asignar cada animal a una finca distinta.
        </p>
      </header>

      <form onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-serif text-xl font-semibold text-stone-900">Datos de la compra</h2>
            <p className="mt-1 text-sm text-stone-500">Indica la subasta, el proveedor o ambos.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field id="factura" label="Número de factura">
                <input id="factura" required maxLength={50} value={header.numero_factura}
                  onChange={(event) => updateHeader('numero_factura', event.target.value)}
                  className={fieldClass} placeholder="FAC-001" />
              </Field>
              <Field id="fecha-compra" label="Fecha de compra">
                <input id="fecha-compra" type="date" required value={header.fecha_compra}
                  onChange={(event) => updateHeader('fecha_compra', event.target.value)}
                  className={fieldClass} />
              </Field>
              <Field id="subasta" label="ID de subasta (opcional)">
                <input id="subasta" maxLength={50} value={header.id_subasta}
                  onChange={(event) => updateHeader('id_subasta', event.target.value)}
                  className={fieldClass} placeholder="SUB-2026-01" />
              </Field>
              <Field id="proveedor" label="Proveedor (opcional)">
                <input id="proveedor" maxLength={100} value={header.proveedor}
                  onChange={(event) => updateHeader('proveedor', event.target.value)}
                  className={fieldClass} placeholder="Nombre del proveedor" />
              </Field>
              <Field id="flete-total" label="Flete total (₡)">
                <input id="flete-total" type="number" min="0" max="9999999999.99" step="0.01" required
                  value={header.costo_flete_total}
                  onChange={(event) => updateHeader('costo_flete_total', event.target.value)}
                  className={fieldClass} />
              </Field>
            </div>
          </section>

          <section aria-labelledby="bovinos-title" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="bovinos-title" className="font-serif text-xl font-semibold text-stone-900">Bovinos adquiridos</h2>
                <p className="mt-1 text-sm text-stone-500">Peso y precio por kilo corresponden a cada animal.</p>
              </div>
              <span className="rounded-full bg-bovi/10 px-3 py-1 text-sm font-medium text-bovi">
                {bovines.length}
              </span>
            </div>

            {bovines.map((bovine, index) => {
              const prefix = `bovine-${bovine.localId}`
              return (
                <div key={bovine.localId} className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-stone-900">Bovino {index + 1}</h3>
                      <p className="text-xs text-stone-500">
                        Costo inicial estimado: {money.format(preview.lines[index].initialCost)}
                        {' · '}incluye {money.format(preview.lines[index].freightShare)} de flete
                      </p>
                    </div>
                    {bovines.length > 1 ? (
                      <button type="button" onClick={() => setBovines((current) => current.filter((item) => item.localId !== bovine.localId))}
                        aria-label={`Quitar bovino ${index + 1}`}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                        <Trash2 className="size-4" /> <span className="hidden sm:inline">Quitar</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id={`${prefix}-finca`} label="Finca de ingreso">
                      <select id={`${prefix}-finca`} required value={bovine.finca_id || defaultFarmId}
                        onChange={(event) => updateBovine(bovine.localId, 'finca_id', event.target.value)}
                        className={fieldClass}>
                        {adminFarms.map((farm) => <option key={farm.id} value={farm.id}>{farm.nombre}</option>)}
                      </select>
                    </Field>
                    <Field id={`${prefix}-sexo`} label="Sexo">
                      <select id={`${prefix}-sexo`} required value={bovine.sexo}
                        onChange={(event) => updateBovine(bovine.localId, 'sexo', event.target.value)}
                        className={fieldClass}>
                        <option value="MACHO">Macho</option>
                        <option value="HEMBRA">Hembra</option>
                      </select>
                    </Field>
                    <Field id={`${prefix}-diio`} label="Número DIIO-SENASA">
                      <input id={`${prefix}-diio`} required maxLength={50} value={bovine.numero_diio}
                        onChange={(event) => updateBovine(bovine.localId, 'numero_diio', event.target.value)}
                        className={fieldClass} placeholder="CL-000123" />
                    </Field>
                    <Field id={`${prefix}-interno`} label="Identificador interno">
                      <input id={`${prefix}-interno`} required maxLength={50} value={bovine.identificador_interno}
                        onChange={(event) => updateBovine(bovine.localId, 'identificador_interno', event.target.value)}
                        className={fieldClass} placeholder="T-014" />
                    </Field>
                    <Field id={`${prefix}-peso`} label="Peso de compra (kg)">
                      <input id={`${prefix}-peso`} type="number" min="0.01" max="9999.99" step="0.01" required
                        value={bovine.peso_compra_kg}
                        onChange={(event) => updateBovine(bovine.localId, 'peso_compra_kg', event.target.value)}
                        className={fieldClass} placeholder="300.00" />
                    </Field>
                    <Field id={`${prefix}-precio`} label="Precio por kilo (₡)">
                      <input id={`${prefix}-precio`} type="number" min="0.01" max="99999999.99" step="0.01" required
                        value={bovine.precio_compra_kilo}
                        onChange={(event) => updateBovine(bovine.localId, 'precio_compra_kilo', event.target.value)}
                        className={fieldClass} placeholder="2000.00" />
                    </Field>
                    <Field id={`${prefix}-ingreso`} label="Fecha de ingreso (opcional)">
                      <input id={`${prefix}-ingreso`} type="date" min={header.fecha_compra}
                        value={bovine.fecha_ingreso}
                        onChange={(event) => updateBovine(bovine.localId, 'fecha_ingreso', event.target.value)}
                        className={fieldClass} />
                    </Field>
                    <Field id={`${prefix}-nacimiento`} label="Fecha de nacimiento (opcional)">
                      <input id={`${prefix}-nacimiento`} type="date" max={header.fecha_compra}
                        value={bovine.fecha_nacimiento}
                        onChange={(event) => updateBovine(bovine.localId, 'fecha_nacimiento', event.target.value)}
                        className={fieldClass} />
                    </Field>
                    <Field id={`${prefix}-nombre`} label="Nombre (opcional)">
                      <input id={`${prefix}-nombre`} maxLength={100} value={bovine.nombre}
                        onChange={(event) => updateBovine(bovine.localId, 'nombre', event.target.value)}
                        className={fieldClass} placeholder="Relámpago" />
                    </Field>
                    <Field id={`${prefix}-raza`} label="Raza (opcional)">
                      <input id={`${prefix}-raza`} maxLength={50} value={bovine.raza}
                        onChange={(event) => updateBovine(bovine.localId, 'raza', event.target.value)}
                        className={fieldClass} placeholder="Angus" />
                    </Field>
                    <Field id={`${prefix}-color`} label="Color (opcional)">
                      <input id={`${prefix}-color`} maxLength={20} value={bovine.color}
                        onChange={(event) => updateBovine(bovine.localId, 'color', event.target.value)}
                        className={fieldClass} placeholder="Negro" />
                    </Field>
                  </div>
                  <p className="mt-4 text-xs text-stone-500">Si dejas la fecha de ingreso vacía, se usará la fecha de compra.</p>
                </div>
              )
            })}

            <button type="button" onClick={() => setBovines((current) => [...current, newBovine()])}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-bovi/40 bg-bovi/5 text-sm font-semibold text-bovi hover:bg-bovi/10">
              <Plus className="size-4" /> Agregar otro bovino
            </button>
          </section>
        </div>

        <aside className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-5">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Resumen estimado</h2>
          <p className="mt-1 text-xs text-stone-500">El importe final se confirma al guardar.</p>
          <dl className="mt-5 space-y-3 text-sm">
            <SummaryRow label="Bovinos" value={String(bovines.length)} />
            <SummaryRow label="Peso total" value={`${preview.weightTotal.toFixed(2)} kg`} />
            <SummaryRow label="Peso × precio/kg" value={money.format(preview.subtotal)} />
            <SummaryRow label="Flete prorrateado" value={money.format(preview.freightTotal)} />
          </dl>
          <div className="mt-5 border-t border-stone-200 pt-4">
            <p className="text-xs font-medium text-stone-500">Costo inicial total</p>
            <p className="mt-1 font-serif text-2xl font-semibold text-stone-900">{money.format(preview.initialTotal)}</p>
          </div>
          {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}
          <button type="submit" disabled={submitting}
            className="mt-5 min-h-12 w-full rounded-xl bg-bovi px-4 text-sm font-semibold text-white transition hover:bg-bovi-hover disabled:cursor-wait disabled:opacity-70">
            {submitting ? 'Registrando compra…' : 'Registrar compra'}
          </button>
        </aside>
      </form>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-800">{value}</dd>
    </div>
  )
}

function PurchaseSuccess({
  result,
  farms,
  onNew,
}: {
  result: PurchaseResult
  farms: Farm[]
  onNew: () => void
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-10">
      <div className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-7">
        <CheckCircle2 className="size-10 text-bovi" />
        <h1 className="mt-4 font-serif text-3xl font-semibold text-stone-900">Compra registrada</h1>
        <p className="mt-2 text-sm text-stone-500">
          Factura {result.numero_factura} · {result.cantidad_bovinos} {result.cantidad_bovinos === 1 ? 'bovino' : 'bovinos'}
        </p>
        <dl className="mt-6 space-y-3 border-y border-stone-100 py-5 text-sm">
          <SummaryRow label="Peso total" value={`${Number(result.peso_total_kg).toFixed(2)} kg`} />
          <SummaryRow label="Peso × precio/kg" value={money.format(Number(result.subtotal_animales))} />
          <SummaryRow label="Flete total" value={money.format(Number(result.costo_flete_total))} />
          <SummaryRow label="Costo inicial total" value={money.format(Number(result.costo_inicial_total))} />
        </dl>

        <h2 className="mt-6 font-serif text-xl font-semibold text-stone-900">Bovinos registrados</h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {result.bovinos.map((bovine) => (
            <li key={bovine.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>
                <span className="block font-medium text-stone-800">{bovine.numero_diio}</span>
                <span className="text-xs text-stone-500">
                  {farms.find((farm) => farm.id === bovine.finca_id)?.nombre ?? 'Finca'} · {Number(bovine.peso_compra_kg).toFixed(2)} kg
                  {' · '}flete: {money.format(Number(bovine.costo_flete_asignado))}
                </span>
              </span>
              <span className="font-semibold text-stone-900">{money.format(Number(bovine.costo_inicial))}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onNew}
            className="min-h-12 rounded-xl bg-bovi px-5 text-sm font-semibold text-white hover:bg-bovi-hover">
            Registrar otra compra
          </button>
          <Link to="/inicio" className="flex min-h-12 items-center justify-center rounded-xl border border-stone-200 px-5 text-sm font-medium text-stone-700 hover:bg-cream">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
