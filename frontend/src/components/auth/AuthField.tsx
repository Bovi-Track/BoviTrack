import type { InputHTMLAttributes, ReactNode } from 'react'

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  icon: ReactNode
  labelExtra?: ReactNode
  hint?: ReactNode
}

export function AuthField({
  id,
  label,
  icon,
  labelExtra,
  hint,
  ...props
}: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <div
        className={
          labelExtra
            ? 'flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3'
            : ''
        }
      >
        <label htmlFor={id} className="text-sm font-medium text-stone-800">
          {label}
        </label>
        {labelExtra}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-400">
          {icon}
        </span>
        <input
          id={id}
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pr-3 pl-10 text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-bovi focus:ring-2 focus:ring-bovi/20"
          {...props}
        />
      </div>
      {hint}
    </div>
  )
}
