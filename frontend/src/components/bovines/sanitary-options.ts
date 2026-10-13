import { Bug, Pill, Stethoscope, Syringe, type LucideIcon } from 'lucide-react'
import type { PlanStatus, SanitaryKind } from '../../types/sanitary.ts'

// Etiquetas, iconos y colores compartidos por la ficha y el calendario sanitario.
export const kinds: {
  id: SanitaryKind
  label: string
  short: string
  icon: LucideIcon
  chip: string
  bar: string
  placeholder: string
}[] = [
    {
      id: 'VACUNACION',
      label: 'Vacunación',
      short: 'Vacuna',
      icon: Syringe,
      chip: 'bg-emerald-100 text-emerald-800',
      bar: 'bg-emerald-600',
      placeholder: 'Clostridial, aftosa, rabia…',
    },
    {
      id: 'DESPARASITACION',
      label: 'Desparasitación',
      short: 'Desparasitar',
      icon: Bug,
      chip: 'bg-amber-100 text-amber-900',
      bar: 'bg-amber-500',
      placeholder: 'Ivermectina, albendazol…',
    },
    {
      id: 'VITAMINIZACION',
      label: 'Vitaminización',
      short: 'Vitaminas',
      icon: Pill,
      chip: 'bg-sky-100 text-sky-900',
      bar: 'bg-sky-600',
      placeholder: 'Complejo B, ADE…',
    },
    {
      id: 'TRATAMIENTO',
      label: 'Tratamiento médico',
      short: 'Tratamiento',
      icon: Stethoscope,
      chip: 'bg-rose-100 text-rose-800',
      bar: 'bg-rose-600',
      placeholder: 'Antibiótico, antiinflamatorio…',
    },
  ]

export const kindById = Object.fromEntries(kinds.map((item) => [item.id, item])) as Record<
  SanitaryKind,
  (typeof kinds)[number]
>

export const planStatusLabel: Record<PlanStatus, string> = {
  vacio: 'Sin registro',
  vencido: 'Vencido',
  proximo: 'Próximo',
  aldia: 'Al día',
  sin_proxima: 'Aplicado',
}

export const planStatusClass: Record<PlanStatus, string> = {
  vacio: 'bg-stone-100 text-stone-600',
  vencido: 'bg-red-100 text-red-800',
  proximo: 'bg-amber-100 text-amber-900',
  aldia: 'bg-bovi/10 text-bovi',
  sin_proxima: 'bg-stone-100 text-stone-700',
}
