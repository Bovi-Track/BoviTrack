type SegmentButtonProps = {
  active: boolean
  onClick: () => void
  label: string
  className?: string
}

// Presenta una opción del selector segmentado resaltando su estado activo.
export function SegmentButton({ active, onClick, label, className = '' }: SegmentButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 cursor-pointer rounded-xl text-sm font-medium ${active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'} ${className}`}
    >
      {label}
    </button>
  )
}
