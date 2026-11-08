import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '../App.tsx'
import { AuthContext, type AuthContextValue } from '../auth/useAuth.ts'
import { BottomNav } from '../components/dashboard/BottomNav.tsx'
import { FarmScreen } from '../components/dashboard/AppShell.tsx'
import { FarmContext, type FarmContextValue } from '../context/useFarm.ts'
import type { FarmRole } from '../types/dashboard.ts'

const farm = { id: 'finca-norte', nombre: 'Finca Norte', ubicacion: 'Guápiles', activo: true }

function farmValue(role: FarmRole): FarmContextValue {
  return {
    farms: [farm],
    rolesByFarm: { [farm.id]: role },
    activeFarm: farm,
    role,
    loading: false,
    loadedUserId: 'usuario-1',
    setActiveFarmId: () => undefined,
    createAndSelectFarm: async () => farm,
    updateActiveFarm: async () => farm,
    refreshFarms: async () => undefined,
  }
}

function authValue(signedIn: boolean): AuthContextValue {
  return {
    user: signedIn ? { id: 'usuario-1' } as AuthContextValue['user'] : null,
    loading: false,
    passwordRecovery: false,
    accessError: null,
    clearPasswordRecovery: () => undefined,
  }
}

describe('acceso por rol en la interfaz', () => {
  afterEach(() => {
    cleanup()
  })

  it('CP-AUTH-01 sin sesión una ruta privada regresa al inicio de sesión', () => {
    render(
      <AuthContext.Provider value={authValue(false)}>
        <MemoryRouter initialEntries={['/inicio']}>
          <Routes>
            <Route path="/inicio" element={<RequireAuth><p>privado</p></RequireAuth>} />
            <Route path="/iniciar-sesion" element={<h1>Bienvenido de nuevo</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeTruthy()
    expect(screen.queryByText('privado')).toBeNull()
  })

  it('CP-ROL-01 el personal de campo no entra a compras, ventas, reporte ni finca', () => {
    render(
      <FarmContext.Provider value={farmValue('campo')}>
        <MemoryRouter initialEntries={['/compras']}>
          <Routes>
            <Route element={<FarmScreen />}>
              <Route path="/compras" element={<p>formulario de compra</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </FarmContext.Provider>,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/ADMINISTRADOR/)
    expect(screen.queryByText('formulario de compra')).toBeNull()
  })

  it('CP-ROL-06 el administrador de la finca sí entra a la ruta financiera', () => {
    render(
      <FarmContext.Provider value={farmValue('admin')}>
        <MemoryRouter initialEntries={['/ventas']}>
          <Routes>
            <Route element={<FarmScreen />}>
              <Route path="/ventas" element={<p>registro de venta</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </FarmContext.Provider>,
    )
    expect(screen.getByText('registro de venta')).toBeTruthy()
  })

  it('CP-ROL-01 la navegación de campo oculta la administración de la finca', () => {
    const { rerender } = render(
      <FarmContext.Provider value={farmValue('campo')}>
        <MemoryRouter>
          <BottomNav />
        </MemoryRouter>
      </FarmContext.Provider>,
    )
    expect(screen.queryByRole('link', { name: 'Finca' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Pesajes' })).toBeTruthy()

    rerender(
      <FarmContext.Provider value={farmValue('admin')}>
        <MemoryRouter>
          <BottomNav />
        </MemoryRouter>
      </FarmContext.Provider>,
    )
    expect(screen.getByRole('link', { name: 'Finca' })).toBeTruthy()
  })
})
