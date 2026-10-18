import { Outlet } from 'react-router-dom'
import { FarmProvider } from '../../context/FarmContext.tsx'
import { BottomNav } from './BottomNav.tsx'
import { OfflineStatus } from '../../offline/OfflineStatus.tsx'
import { useAuth } from '../../auth/useAuth.ts'

// Monta el contexto de finca y la navegación de las pantallas privadas.
export function AppShell() {
  const { user } = useAuth()
  return (
    <FarmProvider key={user?.id}>
      <div className="min-h-svh bg-cream pb-24">
        <OfflineStatus />
        <Outlet />
        <BottomNav />
      </div>
    </FarmProvider>
  )
}
