import { Beef, House, Scale, Settings, Tractor, Warehouse } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useFarm } from '../../context/useFarm.ts'

const items = [
  { to: '/inicio', label: 'Inicio', icon: House },
  { to: '/toros', label: 'Toros', icon: Beef },
  { to: '/pesajes', label: 'Pesajes', icon: Scale },
  { to: '/inventario', label: 'Inventario', icon: Warehouse },
  { to: '/finca', label: 'Finca', icon: Tractor },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

// Presenta la navegación móvil y resalta la ruta activa.
export function BottomNav() {
  const { role } = useFarm()
  const visible = items.filter((item) => item.to !== '/finca' || role === 'admin')
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <ul className={`mx-auto grid max-w-lg gap-1 ${visible.length === 6 ? 'grid-cols-6' : 'grid-cols-5'}`}>
        {visible.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${
                    isActive ? 'bg-bovi/10 text-bovi' : 'text-stone-500'
                  }`
                }
              >
                <Icon className="size-5" strokeWidth={1.8} />
                {item.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
