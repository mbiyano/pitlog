'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehicleSchema, type VehicleFormData } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!hideCustomer && (
        <input type="hidden" {...register('customer_id')} />
      )}

      <div className="space-y-2">
        <Label htmlFor="plate">Patente *</Label>
        <Input
          id="plate"
          placeholder="ABC 123 o AB 123 CD"
          className="font-mono text-lg uppercase"
          {...register('plate')}
        />
        {errors.plate && (
          <p className="text-sm text-destructive">{errors.plate.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="make">Marca</Label>
          <Input id="make" placeholder="Ej: Volkswagen" {...register('make')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" placeholder="Ej: Gol Trend" {...register('model')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="year">Año</Label>
          <Input id="year" type="number" placeholder="2020" {...register('year')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="engine">Motor</Label>
          <Input id="engine" placeholder="1.6 8v" {...register('engine')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mileage_current">Kilometraje</Label>
          <Input
            id="mileage_current"
            type="number"
            placeholder="0"
            {...register('mileage_current')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vin">VIN (opcional)</Label>
        <Input id="vin" {...register('vin')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
      </div>

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? 'Guardando...' : submitLabel}
      </Button>
    </form>
  )
}
