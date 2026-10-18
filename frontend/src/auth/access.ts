import { supabase } from '../lib/supabase.ts'

export const INACTIVE_ACCOUNT = 'Tu cuenta está inactiva. Contacta al administrador.'

// RF-UC14-01: verifica el perfil vigente; un JWT válido no prueba que la cuenta esté activa.
export async function verifyActiveAccount() {
  const { data, error } = await supabase.rpc('verificar_cuenta_activa')
    .abortSignal(AbortSignal.timeout(8000))
  if (error) throw error
  return data === true
}
