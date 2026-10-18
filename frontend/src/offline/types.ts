export type OperationKind = 'weighing' | 'sanitary' | 'inventory' | 'task'
export type OperationState = 'pending' | 'rejected'
export type OfflineOperation = {
  sequence?: number
  id: string
  userId: string
  farmId: string
  kind: OperationKind
  payload: Record<string, unknown>
  optimistic: unknown
  state: OperationState
  error: string | null
  createdAt: string
}
export type CaptureResult<T> = { data: T; pending: boolean; operationId: string }
export type CachedData = { key: string; user_id: string; farm_id: string | null; value: unknown }
