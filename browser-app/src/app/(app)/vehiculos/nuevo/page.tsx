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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldHint } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Info, UserPlus } from 'lucide-react'
import Link from 'next/link'

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
      <PageHeader
        eyebrow="Vehículos"
        title="Nuevo vehículo"
        description="Todo vehículo debe quedar asociado a un cliente existente."
        actions={
          <Button asChild variant="outline">
            <Link href="/vehiculos">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Volver
            </Link>
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Propietario y vehículo</CardTitle>
          <CardDescription>Primero elegí el propietario; después completá los datos del vehículo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field>
            <Label htmlFor="customer">Cliente *</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger id="customer">
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
            <FieldHint>La búsqueda incluye todos los clientes registrados.</FieldHint>
          </Field>
          {!selectedCustomer && (
            <Alert variant="info">
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Seleccioná un cliente para continuar.</span>
                <Button asChild size="sm" variant="outline">
                  <Link href="/clientes/nuevo">
                    <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Crear cliente
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
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
