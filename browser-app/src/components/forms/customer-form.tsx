'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, type CustomerFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldError, FieldHint } from '@/components/ui/field'
import { Loader2 } from 'lucide-react'

interface CustomerFormProps {
  defaultValues?: Partial<CustomerFormData>
  onSubmit: (data: CustomerFormData) => Promise<void>
  submitLabel: string
  loading?: boolean
}

export function CustomerForm({ defaultValues, onSubmit, submitLabel, loading }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      notes: '',
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Field>
        <Label htmlFor="full_name">Nombre completo *</Label>
        <Input
          id="full_name"
          autoComplete="name"
          aria-invalid={Boolean(errors.full_name)}
          aria-describedby={errors.full_name ? 'full_name-error' : undefined}
          {...register('full_name')}
        />
        <FieldError id="full_name-error">{errors.full_name?.message}</FieldError>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" {...register('phone')} />
          <FieldHint>Incluí el código de área para facilitar el contacto.</FieldHint>
        </Field>
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          <FieldError id="email-error">{errors.email?.message}</FieldError>
        </Field>
      </div>

      <Field>
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
        <FieldHint>Información útil para próximas visitas. Evitá datos sensibles innecesarios.</FieldHint>
      </Field>

      <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full sm:w-auto">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? 'Guardando…' : submitLabel}
      </Button>
    </form>
  )
}
