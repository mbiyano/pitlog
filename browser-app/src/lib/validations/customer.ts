import { z } from 'zod'

export const customerSchema = z.object({
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
})

export type CustomerFormData = z.infer<typeof customerSchema>
