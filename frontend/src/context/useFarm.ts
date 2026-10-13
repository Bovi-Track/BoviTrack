import { createContext, useContext } from 'react'
import type { Farm, FarmRole } from '../types/dashboard.ts'

export type FarmContextValue = {
  farms: Farm[]
  rolesByFarm: Record<string, FarmRole>
  activeFarm: Farm | null
  role: FarmRole
  loading: boolean
  loadedUserId: string | null
  setActiveFarmId: (id: string) => void
  createAndSelectFarm: (nombre: string, ubicacion: string) => Promise<Farm>
  updateActiveFarm: (patch: Partial<Pick<Farm, 'nombre' | 'ubicacion' | 'activo'>>) => Promise<Farm>
  refreshFarms: () => Promise<void>
}

export const FarmContext = createContext<FarmContextValue | undefined>(undefined)

// Obtiene la finca y los roles cargados por el FarmProvider compartido.
export function useFarm() {
  const context = useContext(FarmContext)
  if (!context) throw new Error('useFarm debe usarse dentro de FarmProvider')
  return context
}
