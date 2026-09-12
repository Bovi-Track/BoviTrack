type ToastProps = {
  message: string
  tone?: 'ok' | 'warn' | 'error'
}

export function Toast({ message, tone = 'ok' }: ToastProps) {
  const toneClass =
    tone === 'error'
      ? 'bg-red-700'
      : tone === 'warn'
        ? 'bg-amber-700'
        : 'bg-bovi'

  return (
    <div
      role="status"
      className={`fixed top-4 right-4 left-4 z-60 mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toneClass}`}
    >
      {message}
    </div>
  )
}
