// RF-UC14-02: conserva el enlace de recuperación antes de que el enrutador lo borre.
export function recoveryLocation(href: string) {
  const url = new URL(href, 'https://bovitrack.pages.dev')
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const recovery =
    hash.get('type') === 'recovery' ||
    hash.has('access_token') ||
    url.searchParams.get('type') === 'recovery' ||
    url.searchParams.has('code')

  if (!recovery || url.pathname === '/restablecer-contrasena') return null
  return `/restablecer-contrasena${url.search}${url.hash}`
}

const next = recoveryLocation(window.location.href)
if (next) window.history.replaceState(null, '', next)
