import ForgotPasswordPage from './pages/ForgotPasswordPage.tsx'
import FarmManagePage from './pages/FarmManagePage.tsx'
import BullsPage from './pages/BullsPage.tsx'
import HomePage from './pages/HomePage.tsx'
import InventoryPage from './pages/InventoryPage.tsx'
import JoinFarmPage from './pages/JoinFarmPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import PurchasesPage from './pages/PurchasesPage.tsx'
import RegisterPage from './pages/RegisterPage.tsx'
import ReportPage from './pages/ReportPage.tsx'
import SalesPage from './pages/SalesPage.tsx'
import ResetPasswordPage from './pages/ResetPasswordPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import TasksPage from './pages/TasksPage.tsx'
import WeighingsPage from './pages/WeighingsPage.tsx'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth.ts'
import { AppShell } from './components/dashboard/AppShell.tsx'
import type { ReactNode } from 'react'

// RF-UC14-01 (parcial): exige sesión para entrar a las rutas privadas.
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

// Define las rutas públicas y las pantallas operativas de la aplicación.
function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="/unirse" element={<JoinFarmPage />} />
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
        <Route path="/compras" element={<PurchasesPage />} />
        <Route path="/toros" element={<BullsPage />} />
        <Route path="/tareas" element={<TasksPage />} />
        <Route path="/pesajes" element={<WeighingsPage />} />
        <Route path="/inventario" element={<InventoryPage />} />
        <Route path="/reporte" element={<ReportPage />} />
        <Route path="/ventas" element={<SalesPage />} />
        <Route path="/finca" element={<FarmManagePage />} />
        <Route path="/ajustes" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
