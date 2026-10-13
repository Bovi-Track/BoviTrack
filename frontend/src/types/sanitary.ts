export type SanitaryKind =
  | 'VACUNACION'
  | 'DESPARASITACION'
  | 'VITAMINIZACION'
  | 'TRATAMIENTO'

export type SanitaryRecord = {
  id: string
  bovino_id: string
  tipo: SanitaryKind
  producto: string
  dosis: string
  fecha: string
  proxima: string
  responsable: string
  observaciones: string
}

export type PlanStatus = 'vacio' | 'vencido' | 'proximo' | 'aldia' | 'sin_proxima'

export const SANITARY_KINDS: SanitaryKind[] = ['VACUNACION', 'DESPARASITACION', 'VITAMINIZACION', 'TRATAMIENTO']
