import { useOfflineRevision } from '../offline/useOfflineRevision.ts'
import { Check, CircleDollarSign } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Field, Modal, fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/useFarm.ts'
import { bovineLabel, loadBovines } from '../lib/bovines.ts'
import { formatDate, todayIso } from '../lib/dates.ts'
import { calculateSalePreview, loadBovineAcquisitionCosts, loadSales, registerSale } from '../lib/sales.ts'
import { loadWeighings } from '../lib/weighings.ts'
import type { Bovine, BovineAcquisitionCost, SalePreview, SaleRecord, Weighing } from '../types/dashboard.ts'

const money = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// RF-UC12-01/02: registra ventas exclusivamente para el administrador de la finca activa.
export default function SalesPage() {
  const revision = useOfflineRevision()
  const { activeFarm, role, loading: farmLoading } = useFarm()
  const [bovines, setBovines] = useState<Bovine[]>([])
  const [weighings, setWeighings] = useState<Weighing[]>([])
  const [costs, setCosts] = useState<BovineAcquisitionCost[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBovineId, setSelectedBovineId] = useState('')
  const [saleDate, setSaleDate] = useState(todayIso)
  const [exitWeight, setExitWeight] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')
  const [buyerChannel, setBuyerChannel] = useState('')
  const [dailyMaintenance, setDailyMaintenance] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!activeFarm || role !== 'admin') {
      return
    }
    let current = true
    const farmId = activeFarm.id
    async function load() {
      setLoading(true)
      try {
        const [allBovines, nextSales, nextCosts] = await Promise.all([
          loadBovines(farmId), loadSales(farmId), loadBovineAcquisitionCosts(farmId),
        ])
        const ids = allBovines.map((bovine) => bovine.id)
        const nextWeighings = await loadWeighings(ids, farmId)
        if (!current) return
        setBovines(allBovines)
        setSales(nextSales)
        setCosts(nextCosts)
        setWeighings(nextWeighings)
        setSelectedBovineId((selected) => selected || allBovines.find((item) => item.estado === 'ACTIVO')?.id || '')
      } catch (cause) {
        if (current) setToast({
          message: cause instanceof Error ? cause.message : 'No se pudieron cargar las ventas.',
          tone: 'error',
        })
      } finally {
        if (current) setLoading(false)
      }
    }
    void load()
    return () => { current = false }
  }, [activeFarm, role, revision])

  const activeBovines = useMemo(() => bovines.filter((item) => item.estado === 'ACTIVO'), [bovines])
  const selectedBovine = activeBovines.find((item) => item.id === selectedBovineId)
  const preview: SalePreview | null = selectedBovine && dailyMaintenance.trim() !== ''
    ? calculateSalePreview(
      selectedBovine,
      costs.find((item) => item.id === selectedBovine.id),
      weighings,
      saleDate,
      Number(exitWeight),
      Number(pricePerKg),
      Number(dailyMaintenance),
    )
    : null

  async function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedBovine || !preview || !activeFarm || role !== 'admin') return
    if (saleDate > todayIso()) {
      setToast({ message: 'La fecha de venta no puede ser futura.', tone: 'error' })
      return
    }
    setConfirmOpen(true)
  }

  async function confirmSale() {
    if (!selectedBovine || !preview || role !== 'admin') return
    setSaving(true)
    try {
      const saved = await registerSale({
        bovinoId: selectedBovine.id,
        fechaVenta: saleDate,
        pesoSalidaKg: Number(exitWeight),
        precioKilo: Number(pricePerKg),
        compradorCanal: buyerChannel.trim(),
        mantenimientoDiario: Number(dailyMaintenance),
      })
      setSales((current) => [saved, ...current])
      setBovines((current) => current.map((item) => item.id === selectedBovine.id
        ? { ...item, estado: 'VENDIDO' } : item))
      setConfirmOpen(false)
      setSelectedBovineId('')
      setSaleDate(todayIso())
      setExitWeight('')
      setPricePerKg('')
      setBuyerChannel('')
      setDailyMaintenance('')
      setToast({ message: 'Venta registrada y toro marcado como vendido.', tone: 'ok' })
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : 'No se pudo registrar la venta.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (farmLoading || (activeFarm && role === 'admin' && loading)) return <p className="px-4 pt-10 text-sm text-stone-500">Cargando ventas…</p>
  if (!activeFarm || role !== 'admin') return <p role="alert" className="p-6">Las ventas requieren rol ADMINISTRADOR en la finca seleccionada.</p>

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bovi">Finca activa · {activeFarm.nombre}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">Ventas</h1>
        <p className="mt-2 text-sm text-stone-500">Registra la salida, calcula la rentabilidad disponible y conserva el historial.</p>
      </header>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-serif text-xl font-semibold text-stone-900">Registrar venta</h2>
        {!activeFarm.activo ? (
          <p className="text-sm text-stone-500">La finca está inactiva; puedes consultar el historial, pero no registrar ventas.</p>
        ) : activeBovines.length === 0 ? (
          <p className="text-sm text-stone-500">No hay toros activos disponibles para vender.</p>
        ) : (
          <form className="space-y-4" onSubmit={requestConfirmation}>
            <Field id="sale-bovine" label="Toro">
              <select id="sale-bovine" required value={selectedBovineId}
                onChange={(event) => setSelectedBovineId(event.target.value)} className={fieldClass}>
                <option value="">Selecciona un toro</option>
                {activeBovines.map((bovine) => <option key={bovine.id} value={bovine.id}>{bovineLabel(bovine)}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="sale-date" label="Fecha de venta">
                <input id="sale-date" type="date" required max={todayIso()} min={selectedBovine?.fecha_ingreso}
                  value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className={fieldClass} />
              </Field>
              <Field id="sale-weight" label="Peso de salida (kg)">
                <input id="sale-weight" type="number" required min="0.01" max="9999.99" step="0.01" inputMode="decimal"
                  value={exitWeight} onChange={(event) => setExitWeight(event.target.value)} className={fieldClass} />
              </Field>
              <Field id="sale-price" label="Precio de venta (CRC/kg)">
                <input id="sale-price" type="number" required min="0.01" max="99999999.99" step="0.01" inputMode="decimal"
                  value={pricePerKg} onChange={(event) => setPricePerKg(event.target.value)} className={fieldClass} />
              </Field>
              <Field id="sale-maintenance" label="Alimentación y otros cuidados (CRC/toro/día)">
                <input id="sale-maintenance" type="number" required min="0" step="0.01" inputMode="decimal"
                  value={dailyMaintenance} onChange={(event) => setDailyMaintenance(event.target.value)} className={fieldClass} />
              </Field>
            </div>
            <Field id="sale-buyer" label="Comprador o canal">
              <input id="sale-buyer" type="text" required maxLength={100} value={buyerChannel}
                onChange={(event) => setBuyerChannel(event.target.value)} className={fieldClass} />
            </Field>

            {preview ? (
              <div className="rounded-2xl bg-cream p-4 text-sm">
                <p className="font-medium text-stone-800">Vista previa de rentabilidad</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-stone-600">
                  <PreviewRow label="Ingreso bruto" value={money.format(preview.ingresoBruto)} />
                  <PreviewRow label="Costo de compra" value={preview.costoCompra == null ? 'No disponible' : money.format(preview.costoCompra)} />
                  <PreviewRow label={`Alimentación y cuidados (${preview.diasMantenimiento} días)`} value={money.format(preview.mantenimientoAcumulado)} />
                  <PreviewRow label="Rentabilidad final" value={preview.rentabilidad == null ? 'No disponible' : money.format(preview.rentabilidad)} />
                </dl>
                {preview.rentabilidad == null ? <p className="mt-2 text-xs text-amber-800">Falta compra, precio/kg o pesaje inicial. La venta se puede registrar, pero no se inventará una rentabilidad.</p> : null}
              </div>
            ) : null}
            <p className="text-xs text-stone-400">Ingresa el costo diario promedio por toro: por ejemplo, 2 kg de alimento a CRC 300/kg más CRC 100 de otros cuidados = CRC 700/día. Se multiplica por los días transcurridos desde el ingreso hasta la venta (el mismo día son 0 días). La ganancia resta compra, flete y ese total del ingreso de venta. Incluye aquí los gastos que quieras considerar; no se descuentan automáticamente del inventario.</p>
            <button type="submit" disabled={!preview || saving}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-bovi px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              <CircleDollarSign className="size-4" /> Revisar y confirmar venta
            </button>
          </form>
        )}
      </section>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-serif text-xl font-semibold text-stone-900">Historial de ventas</h2>
        {sales.length === 0 ? <p className="text-sm text-stone-400">Aún no hay ventas registradas.</p> : (
          <ul className="space-y-2">
            {sales.map((sale) => <li key={sale.id} className="rounded-xl bg-cream px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-stone-900">{sale.nombre ? `${sale.nombre} · ${sale.identificador_interno}` : sale.identificador_interno}</span>
                <span className="text-xs text-stone-500">{formatDate(sale.fecha_venta)}</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">{quantity.format(sale.peso_salida_kg)} kg · {money.format(sale.precio_kilo)}/kg · {sale.comprador_canal}</p>
              <p className="mt-1 text-xs font-medium text-stone-700">Rentabilidad: {sale.rentabilidad_calculada == null ? 'No disponible' : money.format(sale.rentabilidad_calculada)}</p>
            </li>)}
          </ul>
        )}
      </section>

      <Modal title="Confirmar venta" open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}
        description="Esta operación conserva el registro y cambia el estado del toro a Vendido.">
        {selectedBovine && preview ? <div className="space-y-2 text-sm text-stone-700">
          <p><strong>{bovineLabel(selectedBovine)}</strong> · {formatDate(saleDate)}</p>
          <p>{quantity.format(Number(exitWeight))} kg × {money.format(Number(pricePerKg))}/kg a {buyerChannel.trim()}.</p>
          <p>Rentabilidad final: <strong>{preview.rentabilidad == null ? 'No disponible' : money.format(preview.rentabilidad)}</strong></p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" disabled={saving} onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-xl border border-stone-200 px-3 text-sm font-semibold text-stone-700">Volver</button>
            <button type="button" disabled={saving} onClick={() => void confirmSale()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-bovi px-3 text-sm font-semibold text-white disabled:opacity-50">
              <Check className="size-4" /> {saving ? 'Guardando…' : 'Confirmar venta'}
            </button>
          </div>
        </div> : null}
      </Modal>
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </main>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-stone-500">{label}</dt><dd className="font-semibold text-stone-800">{value}</dd></div>
}
