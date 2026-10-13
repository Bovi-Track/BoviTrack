import { kindById } from './sanitary-options.ts'
import { formatDayLong as formatIso } from '../../lib/dates.ts'
import type { SanitaryRecord } from '../../types/sanitary.ts'

// Presenta una aplicación sanitaria con producto, dosis, fechas y responsable.
export function HistoryItem({
  item,
  caption,
  onRemove,
}: {
  item: SanitaryRecord
  caption?: string
  onRemove?: (id: string) => void
}) {
  const kind = kindById[item.tipo]
  const Icon = kind.icon
  return (
    <div className="flex gap-3">
      <div className={`mt-1 h-full w-1 shrink-0 rounded-full ${kind.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-900">
              {caption ? `${caption} · ` : ''}
              {item.producto}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
              <Icon className="size-3.5" />
              {kind.label} · {formatIso(item.fecha)}
              {item.dosis ? ` · ${item.dosis}` : ''}
            </p>
          </div>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="cursor-pointer text-xs font-medium text-stone-400 hover:text-red-700"
            >
              Quitar
            </button>
          ) : null}
        </div>
        {item.proxima ? (
          <p className="mt-1 text-xs text-stone-600">Próxima {formatIso(item.proxima)}</p>
        ) : null}
        {item.responsable ? (
          <p className="mt-1 text-xs text-stone-500">Aplicó {item.responsable}</p>
        ) : null}
        {item.observaciones ? (
          <p className="mt-1 text-xs text-stone-500">{item.observaciones}</p>
        ) : null}
      </div>
    </div>
  )
}
