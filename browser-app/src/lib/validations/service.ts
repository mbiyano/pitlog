import { z } from 'zod'

export const serviceItemSchema = z.object({
  category: z.string().default('general'),
  title: z.string().min(1, 'El título es obligatorio'),
  description: z.string().optional().nullable(),
  parts_used_json: z.any().default([]),
  next_service_date: z.string().optional().nullable(),
  next_service_mileage: z.coerce.number().int().min(0).optional().nullable(),
})

export const serviceVisitSchema = z.object({
  vehicle_id: z.string().uuid('Vehículo inválido'),
  customer_id: z.string().uuid('Cliente inválido'),
  visit_date: z.string().default(() => new Date().toISOString().split('T')[0]),
  mileage: z.coerce.number().int().min(0).optional().nullable(),
  intake_notes: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  items: z.array(serviceItemSchema).min(1, 'Agregá al menos un servicio'),
})

export type ServiceItemFormData = z.infer<typeof serviceItemSchema>
export type ServiceVisitFormData = z.infer<typeof serviceVisitSchema>

export const SERVICE_CATEGORIES = [
  { value: 'aceite', label: 'Cambio de aceite' },
  { value: 'frenos', label: 'Frenos' },
  { value: 'suspension', label: 'Suspensión' },
  { value: 'motor', label: 'Motor' },
  { value: 'electricidad', label: 'Electricidad' },
  { value: 'neumaticos', label: 'Neumáticos' },
  { value: 'transmision', label: 'Transmisión' },
  { value: 'refrigeracion', label: 'Refrigeración' },
  { value: 'escape', label: 'Escape' },
  { value: 'alineacion', label: 'Alineación y balanceo' },
  { value: 'general', label: 'General' },
  { value: 'otro', label: 'Otro' },
] as const
