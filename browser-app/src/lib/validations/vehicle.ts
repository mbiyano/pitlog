import { z } from 'zod'

export const vehicleSchema = z.object({
  customer_id: z.string().uuid('Cliente inválido'),
  plate: z
    .string()
    .min(6, 'La patente debe tener al menos 6 caracteres')
    .transform((v) => v.toUpperCase().trim()),
  vin: z.string().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  engine: z.string().optional().nullable(),
  mileage_current: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
})

export type VehicleFormData = z.infer<typeof vehicleSchema>
