'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createVehicle } from '@/lib/services/vehicles'
import { getCustomers } from '@/lib/services/customers'
import type { VehicleFormData } from '@/lib/validations'
import type { Customer } from '@/lib/supabase/types'
import { PageHeader } from '@/components/layout/page-header'
import { VehicleForm } from '@/components/forms/vehicle-form'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

export default function NewVehiclePage() {
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const presetCustomerId = searchParams.get('customer_id')

  useEffect(() => {
    async function loadCustomers() {
      const supabase = createClient()
      const data = await getCustomers(supabase)
      setCustomers(data as Customer[])
      if (presetCustomerId) setSelectedCustomer(presetCustomerId)
    }
    loadCustomers()
  }, [presetCustomerId])

  async function handleSubmit(data: VehicleFormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      const vehicle = await createVehicle(supabase, {
        customer_id: selectedCustomer,
        plate: data.plate,
        vin: data.vin ?? null,
        make: data.make ?? null,
        model: data.model ?? null,
        year: data.year ?? null,
        engine: data.engine ?? null,
        mileage_current: data.mileage_current ?? 0,
        notes: data.notes ?? null,
      })
      toast({ title: 'Vehículo creado', description: vehicle.plate })
      router.push(`/vehiculos/${vehicle.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error && err.message.includes('vehicles_plate_unique')
        ? 'Ya existe un vehículo con esa patente'
        : 'No se pudo crear el vehículo'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo vehículo" />
      <Card className="max-w-2xl">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCustomer && (
            <VehicleForm
              defaultValues={{ customer_id: selectedCustomer }}
              onSubmit={handleSubmit}
              submitLabel="Crear vehículo"
              loading={loading}
              hideCustomer
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
