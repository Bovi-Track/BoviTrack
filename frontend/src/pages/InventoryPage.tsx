import { Plus, Warehouse } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { Field, Modal, fieldClass } from '../components/dashboard/Modal.tsx'
import { Toast } from '../components/dashboard/Toast.tsx'
import { useFarm } from '../context/FarmContext.tsx'
import { todayIso } from '../lib/dashboard.ts'
import {
  deactivateInventoryItem, inventoryErrorMessage, loadInventory, loadInventoryMovements,
  registerInventoryMovement, saveInventoryItem,
} from '../lib/inventory.ts'
import type { Farm, FarmRole } from '../types/dashboard.ts'
import {
  INVENTORY_CATEGORIES, MOVEMENT_TYPES, movementLabels,
  type InventoryCategory, type InventoryItem, type InventoryMovement, type MovementType,
} from '../types/inventory.ts'

const actionClass = 'min-h-11 cursor-pointer rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-bovi disabled:cursor-not-allowed disabled:opacity-50'
const primaryClass = 'min-h-12 cursor-pointer rounded-xl bg-bovi px-4 text-sm font-medium text-white hover:bg-bovi-hover disabled:cursor-not-allowed disabled:opacity-50'
const categoryLabels: Record<InventoryCategory, string> = {
  ALIMENTO: 'Alimento', SUPLEMENTO: 'Suplemento', MEDICAMENTO: 'Medicamento', VACUNA: 'Vacuna',
}
const units = ['kg', 'qq', 'L', 'und', 'dosis']
const quantityLabel = (value: number) => value.toLocaleString('es-CR', { maximumFractionDigits: 2 })
type Dialog = { kind: 'catalog'; item?: InventoryItem } | { kind: 'movement' | 'deactivate'; item: InventoryItem }

export default function InventoryPage() {
  const { activeFarm, rolesByFarm, loading, loadedUserId } = useFarm()
  const { user, loading: authLoading } = useAuth()
  if (loading || authLoading) return <p className="px-4 pt-10 text-sm text-stone-500">Cargando inventario…</p>
  if (user && loadedUserId !== user.id) return <p role="alert" className="px-4 pt-10 text-sm text-red-700">No se pudo verificar tu acceso a las fincas. <button type="button" className="underline" onClick={() => window.location.reload()}>Reintentar</button></p>
  if (!activeFarm || !user) return <p className="px-4 pt-10 text-sm text-stone-500">Selecciona una finca desde Inicio para consultar la bodega.</p>
  const role = rolesByFarm[activeFarm.id] ?? 'unknown'
  if (role === 'unknown') return <p role="alert" className="px-4 pt-10 text-sm text-red-700">Tu rol en esta finca no permite acceder al inventario.</p>
  // El cambio de finca/usuario desmonta el estado anterior y descarta sus respuestas.
  return <FarmInventory key={`${user.id}:${activeFarm.id}:${role}`} farm={activeFarm} role={role} />
}

function FarmInventory({ farm, role }: { farm: Farm; role: FarmRole }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<InventoryMovement[]>([])
  const [total, setTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [catalog, setCatalog] = useState({ nombre: '', tipo: 'ALIMENTO' as InventoryCategory, unidad_medida: 'kg' })
  const [capture, setCapture] = useState({ tipo: 'ENTRADA' as MovementType, cantidad: '', fecha: todayIso(), observaciones: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const live = useRef(false)
  const historyRequest = useRef(0)
  const catalogRequest = useRef(0)
  const submitting = useRef(false)
  const canAdmin = role === 'admin' && farm.activo
  const canMove = (role === 'admin' || role === 'campo') && farm.activo
  const selected = items.find((i) => i.id === selectedId)

  useEffect(() => {
    live.current = true
    let active = true
    const request = ++catalogRequest.current
    void loadInventory(farm.id).then((next) => {
      if (active && request === catalogRequest.current) { setItems(next); setLoadError(null) }
    }).catch((cause: unknown) => {
      if (active && request === catalogRequest.current) setLoadError(inventoryErrorMessage(cause))
    }).finally(() => { if (active && request === catalogRequest.current) setLoading(false) })
    return () => { active = false; live.current = false }
  }, [farm.id])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function refreshItems() {
    const request = ++catalogRequest.current
    setLoading(true)
    try {
      const next = await loadInventory(farm.id)
      if (live.current && request === catalogRequest.current) { setItems(next); setLoadError(null) }
    } catch (cause) {
      if (live.current && request === catalogRequest.current) setLoadError(inventoryErrorMessage(cause))
    } finally {
      if (live.current && request === catalogRequest.current) setLoading(false)
    }
  }

  async function fetchHistory(itemId: string, offset: number) {
    const request = ++historyRequest.current
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const page = await loadInventoryMovements(itemId, offset)
      if (!live.current || request !== historyRequest.current) return
      setHistory((current) => offset === 0 ? page.movimientos : [...current, ...page.movimientos])
      setTotal(page.total)
    } catch (cause) {
      if (live.current && request === historyRequest.current) setHistoryError(inventoryErrorMessage(cause))
    } finally {
      if (live.current && request === historyRequest.current) setHistoryLoading(false)
    }
  }

  function select(item: InventoryItem) {
    setSelectedId(item.id)
    setHistory([])
    setTotal(0)
    void fetchHistory(item.id, 0)
  }

  function openDialog(next: Dialog) {
    setSaveError(null)
    if (next.kind === 'catalog') setCatalog({ nombre: next.item?.nombre ?? '', tipo: next.item?.tipo ?? 'ALIMENTO', unidad_medida: next.item?.unidad_medida ?? 'kg' })
    if (next.kind === 'movement') setCapture({ tipo: 'ENTRADA', cantidad: '', fecha: todayIso(), observaciones: '' })
    setDialog(next)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog || submitting.current) return
    submitting.current = true
    setSaving(true)
    setSaveError(null)
    const target = dialog
    try {
      let confirmed: InventoryItem
      if (target.kind === 'catalog') {
        confirmed = await saveInventoryItem(farm.id, { ...catalog, id: target.item?.id })
      } else if (target.kind === 'deactivate') {
        confirmed = await deactivateInventoryItem(target.item.id)
      } else {
        const result = await registerInventoryMovement(target.item.id, capture)
        confirmed = { ...target.item, stock: result.stock }
      }
      if (!live.current) return
      setItems((current) => current.some((i) => i.id === confirmed.id)
        ? current.map((i) => i.id === confirmed.id ? confirmed : i) : [...current, confirmed])
      setDialog(null)
      setToast(target.kind === 'movement' ? 'Movimiento confirmado.' : target.kind === 'deactivate' ? 'Insumo desactivado; su historial se conserva.' : 'Insumo guardado.')
      if (target.kind === 'movement' && selectedId === target.item.id) {
        setHistory([])
        setTotal(0)
        void fetchHistory(target.item.id, 0)
      }
      await refreshItems()
    } catch (cause) {
      if (live.current) setSaveError(inventoryErrorMessage(cause))
    } finally {
      submitting.current = false
      if (live.current) setSaving(false)
    }
  }

  const visible = items.filter((i) => filter === 'all' || i.activo === (filter === 'active'))
  const addsStock = capture.tipo === 'ENTRADA' || capture.tipo === 'AJUSTE_POSITIVO'
  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-10">
      {toast ? <Toast message={toast} tone="ok" /> : null}
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-stone-400">BODEGA</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">Inventario</h1>
          <p className="mt-1 text-sm text-stone-500">Insumos y movimientos de {farm.nombre}</p>
        </div>
        {canAdmin ? <button type="button" disabled={saving} onClick={() => openDialog({ kind: 'catalog' })} className={`${primaryClass} inline-flex items-center gap-2`}><Plus className="size-4" />Agregar</button> : null}
      </header>
      {!farm.activo ? <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Finca inactiva. Puedes consultar existencias e historial.</p> : null}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="inventory-filter" className="text-sm">Mostrar</label>
        <select id="inventory-filter" className={`${fieldClass} max-w-40`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option>
        </select>
        <button type="button" className={actionClass} disabled={loading || saving} onClick={() => { void refreshItems(); if (selectedId) { setHistory([]); setTotal(0); void fetchHistory(selectedId, 0) } }}>Actualizar</button>
      </div>
      {loadError ? <div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError} <button type="button" disabled={loading} onClick={() => void refreshItems()} className="underline">Reintentar</button></div> : null}
      {loading ? <p role="status" className="py-5 text-sm text-stone-500">Cargando existencias…</p> : !loadError && visible.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-stone-200 bg-white p-10 text-center">
          <Warehouse className="mx-auto size-10 text-stone-300" /><p className="mt-3 font-serif text-xl">{items.length ? 'No hay insumos con este filtro.' : 'Bodega vacía'}</p>
          {!items.length && canAdmin ? <p className="mt-2 text-sm text-stone-500">Agrega un insumo y luego registra una entrada para cargar existencias.</p> : null}
        </section>
      ) : <ul className="space-y-3">{visible.map((i) => (
        <li key={i.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold">{i.nombre}</h2><p className="text-sm text-stone-500">{categoryLabels[i.tipo]} · {i.unidad_medida} · {i.activo ? 'Activo' : 'Inactivo'}</p></div><p className="text-lg font-semibold text-bovi">{quantityLabel(i.stock)} {i.unidad_medida}</p></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={saving} className={actionClass} onClick={() => select(i)}>Ver historial</button>
            {canMove && i.activo ? <button type="button" disabled={saving} className={actionClass} onClick={() => openDialog({ kind: 'movement', item: i })}>Registrar movimiento</button> : null}
            {canAdmin && i.activo ? <><button type="button" disabled={saving} className={actionClass} onClick={() => openDialog({ kind: 'catalog', item: i })}>Editar</button><button type="button" disabled={saving} className={actionClass} onClick={() => openDialog({ kind: 'deactivate', item: i })}>Desactivar</button></> : null}
          </div>
        </li>
      ))}</ul>}
      {selected ? <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-serif text-xl font-semibold">Historial de {selected.nombre}</h2><button type="button" className={actionClass} disabled={historyLoading || saving} onClick={() => { setHistory([]); setTotal(0); void fetchHistory(selected.id, 0) }}>Actualizar historial</button></div>
        <p className="my-2 text-xs text-stone-500">Los movimientos confirmados se corrigen registrando ajustes adicionales.</p>
        {historyError ? <p role="alert" className="my-3 text-sm text-red-700">{historyError} <button type="button" className="underline" onClick={() => void fetchHistory(selected.id, history.length)}>Reintentar</button></p> : null}
        {!historyLoading && !historyError && !history.length ? <p className="py-4 text-sm text-stone-500">Sin movimientos registrados.</p> : null}
        <ol className="divide-y divide-stone-100">{history.map((m) => <li key={m.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{m.fecha_movimiento} · {movementLabels[m.tipo]}</span><strong>{quantityLabel(m.cantidad)} {selected.unidad_medida}</strong></div><p className="text-stone-500">{m.responsable_nombre || 'Responsable no disponible'}</p>{m.observaciones ? <p className="mt-1 whitespace-pre-wrap break-words">{m.observaciones}</p> : null}</li>)}</ol>
        {historyLoading ? <p role="status" className="py-3 text-sm text-stone-500">Cargando movimientos…</p> : null}
        {history.length < total ? <button type="button" className={actionClass} disabled={historyLoading || saving} onClick={() => void fetchHistory(selected.id, history.length)}>Cargar más ({history.length} de {total})</button> : null}
      </section> : null}
      <Modal open={dialog !== null} onClose={() => { if (!saving) setDialog(null) }} title={dialog?.kind === 'catalog' ? (dialog.item ? 'Editar insumo' : 'Agregar insumo') : dialog?.kind === 'deactivate' ? 'Desactivar insumo' : 'Registrar movimiento'} description={dialog?.item?.nombre}>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
            {dialog?.kind === 'catalog' ? <>
              <Field id="insumo-nombre" label="Nombre del insumo"><input id="insumo-nombre" required maxLength={100} value={catalog.nombre} onChange={(e) => setCatalog({ ...catalog, nombre: e.target.value })} className={fieldClass} /></Field>
              <Field id="insumo-cat" label="Categoría"><select id="insumo-cat" value={catalog.tipo} onChange={(e) => setCatalog({ ...catalog, tipo: e.target.value as InventoryCategory })} className={fieldClass}>{INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select></Field>
              <Field id="insumo-unidad" label="Unidad"><select id="insumo-unidad" value={catalog.unidad_medida} onChange={(e) => setCatalog({ ...catalog, unidad_medida: e.target.value })} className={fieldClass}>{Array.from(new Set([...units, catalog.unidad_medida])).map((u) => <option key={u} value={u}>{u === 'und' ? 'unidades' : u}</option>)}</select></Field>
              <p className="text-xs text-stone-500">{dialog.item ? 'Con movimientos registrados, solo puedes cambiar el nombre. No se convierten unidades.' : 'El insumo se crea con saldo cero. Registra una entrada después de guardarlo.'}</p>
            </> : dialog?.kind === 'movement' ? <>
              <Field id="mov-tipo" label="Tipo de movimiento"><select id="mov-tipo" value={capture.tipo} onChange={(e) => setCapture({ ...capture, tipo: e.target.value as MovementType })} className={fieldClass}>{MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{movementLabels[t]}</option>)}</select></Field>
              <p className="text-sm text-stone-500">Este movimiento {addsStock ? 'suma a' : 'resta de'} las existencias. Saldo: {quantityLabel(dialog.item.stock)} {dialog.item.unidad_medida}.</p>
              <Field id="mov-cantidad" label={`Cantidad a ${addsStock ? 'sumar' : 'restar'} (${dialog.item.unidad_medida})`}><input id="mov-cantidad" type="number" required min="0.01" max="99999999.99" step="0.01" value={capture.cantidad} onChange={(e) => setCapture({ ...capture, cantidad: e.target.value })} className={fieldClass} /></Field>
              <Field id="mov-fecha" label="Fecha del movimiento"><input id="mov-fecha" type="date" required value={capture.fecha} onChange={(e) => setCapture({ ...capture, fecha: e.target.value })} className={fieldClass} /></Field>
              <Field id="mov-observaciones" label="Observaciones (opcional)"><textarea id="mov-observaciones" rows={3} value={capture.observaciones} onChange={(e) => setCapture({ ...capture, observaciones: e.target.value })} className={fieldClass} /></Field>
              <p className="text-xs text-stone-500">Requiere conexión. Si no recibes confirmación, actualiza el historial antes de repetir la captura.</p>
            </> : <p className="text-sm text-stone-600">Se conserva el historial y el saldo. Este insumo dejará de admitir movimientos.</p>}
            {saveError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p> : null}
            <button type="submit" disabled={saving || !farm.activo} className={`${primaryClass} w-full`}>{saving ? 'Confirmando…' : dialog?.kind === 'movement' ? 'Guardar movimiento' : dialog?.kind === 'deactivate' ? 'Confirmar desactivación' : 'Guardar insumo'}</button>
            <button type="button" className={`${actionClass} w-full`} onClick={() => setDialog(null)}>Cancelar</button>
          </fieldset>
        </form>
      </Modal>
    </div>
  )
}
