import type { ReactNode } from 'react'

type ModalProps = {
  title: string
  description?: ReactNode
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({
  title,
  description,
  open,
  onClose,
  children,
}: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-stone-900/40"
        onClick={onClose}
      />
      <div className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-3xl border border-stone-200 bg-cream p-5 shadow-xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mb-5">
          <h2 className="font-serif text-2xl font-semibold text-stone-900">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-stone-500">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}

export const fieldClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-base text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-bovi focus:ring-2 focus:ring-bovi/20'

export function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
    </div>
  )
}
