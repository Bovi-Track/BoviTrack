import { Outlet, useLocation } from 'react-router-dom'
import { FarmProvider } from '../../context/FarmContext.tsx'
import { BottomNav } from './BottomNav.tsx'
import { OfflineStatus } from '../../offline/OfflineStatus.tsx'
import { useAuth } from '../../auth/useAuth.ts'
import { useFarm } from '../../context/useFarm.ts'

// RF-UC14-03: limita rutas administrativas y descarta pantallas de otra finca o rol.
function FarmScreen() {
  const { activeFarm, role, loadedUserId, loading } = useFarm()
  const { pathname } = useLocation()
  if (loading && !loadedUserId) return <p className="p-6">Cargando…</p>
  if (['/finca', '/compras', '/reporte'].includes(pathname) && role !== 'admin') {
    return <p role="alert" className="p-6">Selecciona una finca donde tengas el rol ADMINISTRADOR para acceder.</p>
  }
  return <Outlet key={`${activeFarm?.id ?? ''}:${role}`} />
}

// Monta el contexto de finca y la navegación de las pantallas privadas.
export function AppShell() {
  const { user } = useAuth()
  return (
    <FarmProvider key={user?.id}>
      <div className="min-h-svh bg-cream pb-24">
        <OfflineStatus />
        <FarmScreen />
        <BottomNav />
      </div>
    </FarmProvider>
  )
}
