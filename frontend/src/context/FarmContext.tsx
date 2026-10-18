import { FarmContext } from './useFarm.ts'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import {
  createFarm as createFarmRequest,
  getStoredFarmId,
  loadUserFarms,
  storeFarmId,
  updateFarm as updateFarmRequest,
} from '../lib/farms.ts'
import type { Farm, FarmRole } from '../types/dashboard.ts'

// RF-UC03-01 y RF-UC14-03: mantiene la finca seleccionada y roles vinculados al usuario.
export function FarmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [farms, setFarms] = useState<Farm[]>([])
  const [rolesByFarm, setRolesByFarm] = useState<Record<string, FarmRole>>({})
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(
    getStoredFarmId(),
  )
  const [loading, setLoading] = useState(true)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const refreshRequest = useRef(0)

  // RF-UC03-01 y RF-UC14-03: recarga fincas y roles, descartando respuestas anteriores.
  const refreshFarms = useCallback(async () => {
    const request = ++refreshRequest.current
    if (!user) {
      setFarms([])
      setRolesByFarm({})
      setLoadedUserId(null)
      setLoading(false)
      return
    }

    try {
      const rows = await loadUserFarms(user.id)
      if (request !== refreshRequest.current) return
      const nextFarms = rows.map((row) => row.farm)
      const nextRoles = Object.fromEntries(
        rows.map((row) => [row.farm.id, row.role]),
      )
      setFarms(nextFarms)
      setRolesByFarm(nextRoles)
      setLoadedUserId(user.id)

      setActiveFarmIdState((current) => {
        const stored = current ?? getStoredFarmId()
        const next =
          nextFarms.find((farm) => farm.id === stored)?.id ??
          nextFarms[0]?.id ??
          null
        storeFarmId(next)
        return next
      })
    } catch {
      if (request !== refreshRequest.current) return
      setFarms([])
      setRolesByFarm({})
      setLoadedUserId(null)
      setActiveFarmIdState(null)
    } finally {
      if (request === refreshRequest.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshFarms()
    window.addEventListener('bovitrack:access', refreshFarms)
    return () => window.removeEventListener('bovitrack:access', refreshFarms)
  }, [refreshFarms])

  // RF-UC03-01: selecciona la finca de trabajo y conserva la preferencia del navegador.
  const setActiveFarmId = useCallback((id: string) => {
    storeFarmId(id)
    setActiveFarmIdState(id)
  }, [])

  // RF-UC03-01: crea una finca y actualiza la selección y rol de su administrador.
  const createAndSelectFarm = useCallback(
    async (nombre: string, ubicacion: string) => {
      const farm = await createFarmRequest(nombre, ubicacion)
      storeFarmId(farm.id)
      setFarms((current) => {
        if (current.some((item) => item.id === farm.id)) return current
        return [farm, ...current]
      })
      setRolesByFarm((current) => ({ ...current, [farm.id]: 'admin' }))
      setLoadedUserId(user?.id ?? null)
      setActiveFarmIdState(farm.id)
      return farm
    },
    [user?.id],
  )

  // RF-UC03-01: guarda cambios de la finca seleccionada y actualiza su estado compartido.
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
  const role = activeFarm && loadedUserId === user?.id
    ? (rolesByFarm[activeFarm.id] ?? 'unknown') : 'unknown'

  const value = useMemo(
    () => ({
      farms,
      rolesByFarm,
      activeFarm,
      role,
      loading,
      loadedUserId,
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
      loadedUserId,
      setActiveFarmId,
      createAndSelectFarm,
      updateActiveFarm,
      refreshFarms,
    ],
  )

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>
}
