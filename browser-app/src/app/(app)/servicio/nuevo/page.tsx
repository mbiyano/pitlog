'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { searchVehicleByPlate, createVehicle } from '@/lib/services/vehicles'
import { getCustomers } from '@/lib/services/customers'
import { createVisitWithItems } from '@/lib/services/visits'
import { serviceVisitSchema, SERVICE_CATEGORIES, type ServiceVisitFormData } from '@/lib/validations'
import type { Customer } from '@/lib/supabase/types'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { Search, Plus, Trash2, Car, Wrench } from 'lucide-react'

export default function NewServicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()

  // Plate search state
  const [plateQuery, setPlateQuery] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [plateResults, setPlateResults] = useState<any[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<{
    id: string
    plate: string
    make: string | null
    model: string | null
    customer_id: string
    customer_name: string
  } | null>(null)
  const [showInlineCreate, setShowInlineCreate] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [saving, setSaving] = useState(false)

  // Inline vehicle creation
  const [newPlate, setNewPlate] = useState('')
  const [newMake, setNewMake] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newYear, setNewYear] = useState('')
  const [newCustomerId, setNewCustomerId] = useState('')

  const form = useForm<ServiceVisitFormData>({
    resolver: zodResolver(serviceVisitSchema),
    defaultValues: {
      vehicle_id: '',
      customer_id: '',
      visit_date: new Date().toISOString().split('T')[0],
      mileage: null,
      intake_notes: '',
      summary: '',
      items: [{ category: 'general', title: '', description: '', parts_used_json: [], next_service_date: null, next_service_mileage: null }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // Load preset vehicle or customer from URL
  useEffect(() => {
    const vehicleId = searchParams.get('vehicle_id')
    if (vehicleId) {
      supabase
        .from('vehicles')
        .select('id, plate, make, model, customer_id, customers(id, full_name)')
        .eq('id', vehicleId)
        .single()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }: { data: any }) => {
          if (data) {
            setSelectedVehicle({
              id: data.id,
              plate: data.plate,
              make: data.make,
              model: data.model,
              customer_id: data.customer_id,
              customer_name: data.customers?.full_name ?? '',
            })
            form.setValue('vehicle_id', data.id)
            form.setValue('customer_id', data.customer_id)
          }
        })
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Search plates
  const handlePlateSearch = useCallback(async (value: string) => {
    setPlateQuery(value)
    if (value.length < 2) {
      setPlateResults([])
      return
    }
    const data = await searchVehicleByPlate(supabase, value)
    setPlateResults(data)
  }, [supabase])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function selectVehicle(v: any) {
    setSelectedVehicle({
      id: v.id,
      plate: v.plate,
      make: v.make,
      model: v.model,
      customer_id: v.customer_id,
      customer_name: v.customers?.full_name ?? '',
    })
    form.setValue('vehicle_id', v.id)
    form.setValue('customer_id', v.customer_id)
    setPlateQuery('')
    setPlateResults([])
  }

  async function handleInlineCreate() {
    if (!newPlate || !newCustomerId) return
    try {
      const vehicle = await createVehicle(supabase, {
        customer_id: newCustomerId,
        plate: newPlate.toUpperCase(),
        make: newMake || null,
        model: newModel || null,
        year: newYear ? parseInt(newYear) : null,
        vin: null,
        engine: null,
        mileage_current: 0,
        notes: null,
      })
      const cust = customers.find((c) => c.id === newCustomerId)
      setSelectedVehicle({
        id: vehicle.id,
        plate: vehicle.plate,
        make: vehicle.make,
        model: vehicle.model,
        customer_id: vehicle.customer_id,
        customer_name: cust?.full_name ?? '',
      })
      form.setValue('vehicle_id', vehicle.id)
      form.setValue('customer_id', vehicle.customer_id)
      setShowInlineCreate(false)
      toast({ title: 'Vehículo creado', description: vehicle.plate })
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message.includes('vehicles_plate_unique')
        ? 'Ya existe un vehículo con esa patente'
        : 'Error al crear vehículo'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }

  async function onSubmit(data: ServiceVisitFormData) {
    setSaving(true)
    try {
      const visit = await createVisitWithItems(supabase, data)
      toast({ title: 'Servicio registrado' })
      router.push(`/vehiculos/${data.vehicle_id}`)
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el servicio', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Load customers when showing inline create
  useEffect(() => {
    if (showInlineCreate && customers.length === 0) {
      getCustomers(supabase).then((data) => setCustomers(data as Customer[]))
    }
  }, [showInlineCreate]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo servicio"
        description="Registrar una nueva visita al taller"
      />

      {/* Step 1: Vehicle selection */}
      {!selectedVehicle ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-5 w-5" />
              Seleccionar vehículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por patente..."
                value={plateQuery}
                onChange={(e) => handlePlateSearch(e.target.value)}
                className="pl-10 font-mono text-lg uppercase"
                autoFocus
              />
            </div>

            {plateResults.length > 0 && (
              <div className="rounded-lg border">
                {plateResults.map((v) => (
                  <button
                    key={v.id}
                    className="flex w-full items-center gap-3 border-b p-4 text-left last:border-b-0 hover:bg-accent"
                    onClick={() => selectVehicle(v)}
                  >
                    <Car className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="font-mono font-bold">{v.plate}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {v.make} {v.model}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {v.customers?.full_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {plateQuery.length >= 2 && plateResults.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">No se encontró ningún vehículo</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setShowInlineCreate(true)
                    setNewPlate(plateQuery.toUpperCase())
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear vehículo nuevo
                </Button>
              </div>
            )}

            {/* Inline vehicle creation */}
            {showInlineCreate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Crear vehículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Patente</Label>
                      <Input
                        value={newPlate}
                        onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                        className="font-mono uppercase"
                      />
                    </div>
                    <div>
                      <Label>Cliente</Label>
                      <Select value={newCustomerId} onValueChange={setNewCustomerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
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
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Marca</Label>
                      <Input value={newMake} onChange={(e) => setNewMake(e.target.value)} />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Input value={newModel} onChange={(e) => setNewModel(e.target.value)} />
                    </div>
                    <div>
                      <Label>Año</Label>
                      <Input
                        type="number"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleInlineCreate} disabled={!newPlate || !newCustomerId}>
                      Crear y seleccionar
                    </Button>
                    <Button variant="ghost" onClick={() => setShowInlineCreate(false)}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Selected vehicle summary */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Car className="h-6 w-6 text-primary" />
                <div>
                  <span className="font-mono text-lg font-bold">{selectedVehicle.plate}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {selectedVehicle.make} {selectedVehicle.model}
                  </span>
                  <p className="text-xs text-muted-foreground">{selectedVehicle.customer_name}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedVehicle(null)
                  form.setValue('vehicle_id', '')
                  form.setValue('customer_id', '')
                }}
              >
                Cambiar
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Visit details form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos de la visita</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" {...form.register('visit_date')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Kilometraje actual</Label>
                    <Input
                      type="number"
                      placeholder="Ej: 45000"
                      {...form.register('mileage')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notas de ingreso</Label>
                  <Textarea
                    placeholder="Motivo de la visita, síntomas, etc."
                    rows={3}
                    {...form.register('intake_notes')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Service items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="h-5 w-5" />
                    Trabajos realizados
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        category: 'general',
                        title: '',
                        description: '',
                        parts_used_json: [],
                        next_service_date: null,
                        next_service_mileage: null,
                      })
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Trabajo #{index + 1}
                      </span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Categoría</Label>
                        <Select
                          value={form.watch(`items.${index}.category`)}
                          onValueChange={(val) => form.setValue(`items.${index}.category`, val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Título *</Label>
                        <Input
                          placeholder="Ej: Cambio de aceite 10W40"
                          {...form.register(`items.${index}.title`)}
                        />
                        {form.formState.errors.items?.[index]?.title && (
                          <p className="text-xs text-destructive">
                            {form.formState.errors.items[index]?.title?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Descripción</Label>
                      <Textarea
                        placeholder="Detalles del trabajo..."
                        rows={2}
                        {...form.register(`items.${index}.description`)}
                      />
                    </div>

                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Próximo servicio (fecha)</Label>
                        <Input
                          type="date"
                          {...form.register(`items.${index}.next_service_date`)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Próximo servicio (km)</Label>
                        <Input
                          type="number"
                          placeholder="Ej: 55000"
                          {...form.register(`items.${index}.next_service_mileage`)}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {form.formState.errors.items?.root && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.items.root.message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Resumen del servicio</Label>
                  <Textarea
                    placeholder="Resumen general (opcional)"
                    rows={2}
                    {...form.register('summary')}
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={saving}>
                  {saving ? 'Guardando...' : 'Registrar servicio'}
                </Button>
              </CardContent>
            </Card>
          </form>
        </>
      )}
    </div>
  )
}
