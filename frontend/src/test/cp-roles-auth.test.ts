import { describe, expect, it } from 'vitest'
import { recoveryLocation } from '../auth/preserveRecoveryUrl.ts'
import { mensajeAuth } from '../auth/service.ts'
import { mapRole, roleLabel } from '../lib/farms.ts'
import { passwordIssues, validarPasswordRegistro } from '../lib/passwordPolicy.ts'

describe('UC-14 autenticación', () => {
  it('CP-AUTH-02 traduce unas credenciales inválidas', () => {
    expect(mensajeAuth('Invalid login credentials')).toBe(
      'Credenciales incorrectas',
    )
  })

  it('CP-AUTH-03 rechaza una contraseña de menos de 6 caracteres', () => {
    expect(passwordIssues('abc12').length).toBeGreaterThan(0)
    expect(validarPasswordRegistro('abc12', 'abc12')).not.toBeNull()
  })

  it('CP-AUTH-05 el regreso a la raíz conserva el enlace de recuperación', () => {
    const hash = '#access_token=token&refresh_token=otro&type=recovery'
    expect(recoveryLocation(`https://bovitrack.pages.dev/${hash}`)).toBe(
      `/restablecer-contrasena${hash}`,
    )
    expect(recoveryLocation(`https://bovitrack.pages.dev/restablecer-contrasena${hash}`)).toBeNull()
    expect(recoveryLocation('https://bovitrack.pages.dev/inicio')).toBeNull()
  })

  it('CP-AUTH-05 la recuperación no acepta una contraseña que no coincide', () => {
    expect(validarPasswordRegistro('Camacho1!', 'Camacho1?')).toBe('Las contraseñas no coinciden')
    expect(validarPasswordRegistro('Camacho1!', 'Camacho1!')).toBeNull()
  })
})

describe('UC-15 usuarios y roles', () => {
  it('CP-USR-06 solo reconoce ADMINISTRADOR y PERSONAL_CAMPO', () => {
    expect(mapRole('ADMINISTRADOR')).toBe('admin')
    expect(mapRole(' administrador ')).toBe('admin')
    expect(mapRole('PERSONAL_CAMPO')).toBe('campo')
    expect(mapRole('CONTADOR')).toBe('unknown')
    expect(mapRole(null)).toBe('unknown')
    expect(roleLabel('admin')).toBe('ADMINISTRADOR')
    expect(roleLabel('campo')).toBe('PERSONAL_CAMPO')
    expect(roleLabel('unknown')).toBe('Rol no reconocido')
  })
})
