import { Outlet } from 'react-router-dom'
import { FarmProvider } from '../../context/FarmContext.tsx'
import { BottomNav } from './BottomNav.tsx'

// Monta el contexto de finca y la navegación de las pantallas privadas.
export function AppShell() {
  return (
    <FarmProvider>
      <div className="min-h-svh bg-cream pb-24">
        <Outlet />
        <BottomNav />
      </div>
    </FarmProvider>
  )
}
