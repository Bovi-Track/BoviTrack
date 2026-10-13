const PENDING_INVITE_KEY = 'bovitrack-pending-invite'

// Conserva el enlace de invitación mientras el usuario se autentica.
export function savePendingInvite(token: string) {
  sessionStorage.setItem(PENDING_INVITE_KEY, token)
}

// Lee la invitación pendiente sin retirarla antes de su aceptación.
export function getPendingInvite() {
  return sessionStorage.getItem(PENDING_INVITE_KEY)
}

// Retira únicamente el enlace que se acaba de aceptar correctamente.
export function clearPendingInvite(token: string) {
  if (getPendingInvite() === token) sessionStorage.removeItem(PENDING_INVITE_KEY)
}
