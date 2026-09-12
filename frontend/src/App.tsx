import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider.tsx'
import { AppShell } from './components/dashboard/AppShell.tsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import RegisterPage from './pages/RegisterPage.tsx'
import ResetPasswordPage from './pages/ResetPasswordPage.tsx'
import SectionPage from './pages/SectionPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import type { ReactNode } from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-cream text-stone-500">
        Cargando…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/iniciar-sesion" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="/iniciar-sesion" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/olvidar-contrasena" element={<ForgotPasswordPage />} />
      <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/inicio" element={<HomePage />} />
        <Route
          path="/toros"
          element={
            <SectionPage
              title="Toros"
              description="Aquí verás el inventario de bovinos de la finca activa. Por ahora registra animales desde el dashboard con Agregar bovino."
            />
          }
        />
        <Route
          path="/pesajes"
          element={
            <SectionPage
              title="Pesajes"
              description="El historial detallado de pesajes llegará aquí. La captura rápida ya está disponible en Inicio."
            />
          }
        />
        <Route
          path="/inventario"
          element={
            <SectionPage
              title="Inventario"
              description="Registra movimientos de bodega e insumos desde este módulo cuando esté habilitado."
            />
          }
        />
        <Route path="/ajustes" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
