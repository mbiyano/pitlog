'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehicleSchema, type VehicleFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldError, FieldHint } from '@/components/ui/field'
import { Loader2 } from 'lucide-react'

interface VehicleFormProps {
  defaultValues?: Partial<VehicleFormData>
  onSubmit: (data: VehicleFormData) => Promise<void>
  submitLabel: string
  loading?: boolean
  hideCustomer?: boolean
}

export function VehicleForm({
  defaultValues,
  onSubmit,
  submitLabel,
  loading,
  hideCustomer,
}: VehicleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate: '',
      make: '',
      model: '',
      mileage_current: 0,
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {!hideCustomer && (
        <input type="hidden" {...register('customer_id')} />
      )}

      <Field>
        <Label htmlFor="plate">Patente *</Label>
        <Input
          id="plate"
          placeholder="ABC 123 o AB 123 CD"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.plate)}
          aria-describedby={errors.plate ? 'plate-error' : 'plate-hint'}
          className="font-mono text-lg font-semibold uppercase tracking-wider"
          {...register('plate')}
        />
        <FieldHint id="plate-hint">Formato antiguo: ABC 123. Mercosur: AB 123 CD.</FieldHint>
        <FieldError id="plate-error">{errors.plate?.message}</FieldError>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="make">Marca</Label>
          <Input id="make" placeholder="Ej: Volkswagen" {...register('make')} />
        </Field>
        <Field>
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" placeholder="Ej: Gol Trend" {...register('model')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <Label htmlFor="year">Año</Label>
          <Input id="year" type="number" placeholder="2020" {...register('year')} />
        </Field>
        <Field>
          <Label htmlFor="engine">Motor</Label>
          <Input id="engine" placeholder="1.6 8v" {...register('engine')} />
        </Field>
        <Field>
          <Label htmlFor="mileage_current">Kilometraje</Label>
          <Input
            id="mileage_current"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            {...register('mileage_current')}
          />
        </Field>
      </div>

      <Field>
        <Label htmlFor="vin">VIN (opcional)</Label>
        <Input id="vin" {...register('vin')} />
        <FieldHint>17 caracteres. Podés completarlo más adelante.</FieldHint>
      </Field>

      <Field>
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
      </Field>

      <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full sm:w-auto">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? 'Guardando…' : submitLabel}
      </Button>
    </form>
  )
}
