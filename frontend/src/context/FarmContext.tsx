import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthProvider.tsx'
import {
  createFarm as createFarmRequest,
  getStoredFarmId,
  loadUserFarms,
  storeFarmId,
} from '../lib/dashboard.ts'
import { updateFarm as updateFarmRequest } from '../lib/farm-manage.ts'
import type { Farm, FarmRole } from '../types/dashboard.ts'

type FarmContextValue = {
  farms: Farm[]
  rolesByFarm: Record<string, FarmRole>
  activeFarm: Farm | null
  role: FarmRole
  loading: boolean
  setActiveFarmId: (id: string) => void
  createAndSelectFarm: (nombre: string, ubicacion: string) => Promise<Farm>
  updateActiveFarm: (patch: Partial<Pick<Farm, 'nombre' | 'ubicacion' | 'activo'>>) => Promise<Farm>
  refreshFarms: () => Promise<void>
}

const FarmContext = createContext<FarmContextValue | undefined>(undefined)

export function FarmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [farms, setFarms] = useState<Farm[]>([])
  const [rolesByFarm, setRolesByFarm] = useState<Record<string, FarmRole>>({})
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(
    getStoredFarmId(),
  )
  const [loading, setLoading] = useState(true)

  const refreshFarms = useCallback(async () => {
    if (!user) {
      setFarms([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const rows = await loadUserFarms(user.id)
      const nextFarms = rows.map((row) => row.farm)
      const nextRoles = Object.fromEntries(
        rows.map((row) => [row.farm.id, row.role]),
      )
      setFarms(nextFarms)
      setRolesByFarm(nextRoles)

      setActiveFarmIdState((current) => {
        const stored = current ?? getStoredFarmId()
        const next =
          nextFarms.find((farm) => farm.id === stored)?.id ??
          nextFarms[0]?.id ??
          null
        storeFarmId(next)
        return next
      })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshFarms()
  }, [refreshFarms])

  const setActiveFarmId = useCallback((id: string) => {
    storeFarmId(id)
    setActiveFarmIdState(id)
  }, [])

  const createAndSelectFarm = useCallback(
    async (nombre: string, ubicacion: string) => {
      const farm = await createFarmRequest(nombre, ubicacion)
      storeFarmId(farm.id)
      setFarms((current) => {
        if (current.some((item) => item.id === farm.id)) return current
        return [farm, ...current]
      })
      setRolesByFarm((current) => ({ ...current, [farm.id]: 'admin' }))
      setActiveFarmIdState(farm.id)
      return farm
    },
    [],
  )

  // Para actualizar lo que es los datos de la finca, nombre, ubicacion, o estado
  const updateActiveFarm = useCallback(
    async (patch: Partial<Pick<Farm, 'nombre' | 'ubicacion' | 'activo'>>) => {
      if (!activeFarmId) throw new Error('No hay finca activa seleccionada.')
      const current = farms.find((f) => f.id === activeFarmId)
      const fullPatch = {
        nombre: patch.nombre ?? current?.nombre ?? '',
        ubicacion: patch.ubicacion ?? current?.ubicacion ?? null,
        activo: patch.activo ?? current?.activo ?? true,
      }
      const updated = await updateFarmRequest(activeFarmId, fullPatch)
      setFarms((list) =>
        list.map((farm) => (farm.id === updated.id ? updated : farm)),
      )
      return updated
    },
    [activeFarmId, farms],
  )

  const activeFarm = farms.find((farm) => farm.id === activeFarmId) ?? null
  const role = activeFarm ? (rolesByFarm[activeFarm.id] ?? 'admin') : 'admin'

  const value = useMemo(
    () => ({
      farms,
      rolesByFarm,
      activeFarm,
      role,
      loading,
      setActiveFarmId,
      createAndSelectFarm,
      updateActiveFarm,
      refreshFarms,
    }),
    [
      farms,
      rolesByFarm,
      activeFarm,
      role,
      loading,
      setActiveFarmId,
      createAndSelectFarm,
      updateActiveFarm,
      refreshFarms,
    ],
  )

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>
}

export function useFarm() {
  const context = useContext(FarmContext)
  if (!context) {
    throw new Error('useFarm debe usarse dentro de FarmProvider')
  }
  return context
}
