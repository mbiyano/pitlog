'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
import { Field, FieldError, FieldHint } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'
import { AlertCircle, ArrowLeft, Loader2, Search, Plus, Trash2, Car } from 'lucide-react'
import Link from 'next/link'

export default function NewServicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  // Plate search state
  const [plateQuery, setPlateQuery] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [plateResults, setPlateResults] = useState<any[]>([])
  const [searchingPlate, setSearchingPlate] = useState(false)
  const [plateSearchError, setPlateSearchError] = useState(false)
  const [hasSearchedPlate, setHasSearchedPlate] = useState(false)
  const plateSearchSequence = useRef(0)
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
      visit_date: format(new Date(), 'yyyy-MM-dd'),
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

  useEffect(() => {
    const value = plateQuery.trim()
    if (value.length < 2) return

    const sequence = ++plateSearchSequence.current
    const timeout = window.setTimeout(async () => {
      setSearchingPlate(true)
      setPlateSearchError(false)
      setHasSearchedPlate(false)
      try {
        const data = await searchVehicleByPlate(supabase, value)
        if (sequence !== plateSearchSequence.current) return
        setPlateResults(data)
        setHasSearchedPlate(true)
      } catch {
        if (sequence !== plateSearchSequence.current) return
        setPlateResults([])
        setPlateSearchError(true)
      } finally {
        if (sequence === plateSearchSequence.current) setSearchingPlate(false)
      }
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [plateQuery, supabase])

  function updatePlateQuery(value: string) {
    setPlateQuery(value)
    if (value.trim().length < 2) {
      setPlateResults([])
      setSearchingPlate(false)
      setPlateSearchError(false)
      setHasSearchedPlate(false)
    }
  }

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
    updatePlateQuery('')
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
      await createVisitWithItems(supabase, data)
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
        eyebrow="Servicios"
        title="Nuevo servicio"
        description="Seleccioná el vehículo y registrá los trabajos realizados durante la visita."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Volver
            </Link>
          </Button>
        }
      />

      {/* Step 1: Vehicle selection */}
      {!selectedVehicle ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
              Seleccionar vehículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field className="relative">
              <Label htmlFor="service-plate-search">Patente, marca o modelo</Label>
              <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="service-plate-search"
                placeholder="Ej: ABC 123"
                value={plateQuery}
                onChange={(e) => updatePlateQuery(e.target.value)}
                className="pl-10 font-mono text-lg uppercase"
                autoFocus
              />
                {searchingPlate && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
              </div>
              <FieldHint>Escribí al menos dos caracteres. La búsqueda espera mientras terminás de escribir.</FieldHint>
            </Field>

            {plateSearchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>No pudimos buscar vehículos. Intentá nuevamente.</AlertDescription>
              </Alert>
            )}

            {plateResults.length > 0 && (
              <div className="overflow-hidden rounded-xl border">
                {plateResults.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="flex min-h-14 w-full items-center gap-3 border-b p-4 text-left transition-colors last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
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

            {hasSearchedPlate && !plateSearchError && plateQuery.length >= 2 && plateResults.length === 0 && (
              <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">No se encontró ningún vehículo</p>
                <Button
                  type="button"
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
                    <Field>
                      <Label htmlFor="new-vehicle-plate">Patente</Label>
                      <Input
                        id="new-vehicle-plate"
                        value={newPlate}
                        onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                        className="font-mono uppercase"
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="new-vehicle-customer">Cliente</Label>
                      <Select value={newCustomerId} onValueChange={setNewCustomerId}>
                        <SelectTrigger id="new-vehicle-customer">
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
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field>
                      <Label htmlFor="new-vehicle-make">Marca</Label>
                      <Input id="new-vehicle-make" value={newMake} onChange={(e) => setNewMake(e.target.value)} />
                    </Field>
                    <Field>
                      <Label htmlFor="new-vehicle-model">Modelo</Label>
                      <Input id="new-vehicle-model" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
                    </Field>
                    <Field>
                      <Label htmlFor="new-vehicle-year">Año</Label>
                      <Input
                        id="new-vehicle-year"
                        type="number"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleInlineCreate} disabled={!newPlate || !newCustomerId}>
                      Crear y seleccionar
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowInlineCreate(false)}>
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
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Car className="h-6 w-6 text-primary" />
                <div className="min-w-0">
                  <span className="font-mono text-lg font-bold">{selectedVehicle.plate}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {selectedVehicle.make} {selectedVehicle.model}
                  </span>
                  <p className="text-xs text-muted-foreground">{selectedVehicle.customer_name}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
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
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
                Datos de la visita
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                    <Label htmlFor="visit-date">Fecha</Label>
                    <Input id="visit-date" type="date" {...form.register('visit_date')} />
                </Field>
                <Field>
                    <Label htmlFor="visit-mileage">Kilometraje actual</Label>
                    <Input
                      id="visit-mileage"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Ej: 45000"
                      aria-invalid={Boolean(form.formState.errors.mileage)}
                      {...form.register('mileage')}
                    />
                    <FieldError>{form.formState.errors.mileage?.message}</FieldError>
                </Field>
              </div>
              <Field>
                  <Label htmlFor="intake-notes">Notas de ingreso</Label>
                  <Textarea
                    id="intake-notes"
                    placeholder="Motivo de la visita, síntomas, etc."
                    rows={3}
                    {...form.register('intake_notes')}
                  />
              </Field>
              </CardContent>
            </Card>

            {/* Step 3: Service items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
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
                  <div key={field.id} className="space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
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
                          aria-label={`Eliminar trabajo ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <Label htmlFor={`item-${index}-category`}>Categoría</Label>
                        <Select
                          value={form.watch(`items.${index}.category`)}
                          onValueChange={(val) => form.setValue(`items.${index}.category`, val)}
                        >
                          <SelectTrigger id={`item-${index}-category`}>
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
                      </Field>
                      <Field>
                        <Label htmlFor={`item-${index}-title`}>Título *</Label>
                        <Input
                          id={`item-${index}-title`}
                          placeholder="Ej: Cambio de aceite 10W40"
                          aria-invalid={Boolean(form.formState.errors.items?.[index]?.title)}
                          {...form.register(`items.${index}.title`)}
                        />
                        <FieldError>{form.formState.errors.items?.[index]?.title?.message}</FieldError>
                      </Field>
                    </div>

                    <Field>
                      <Label htmlFor={`item-${index}-description`}>Descripción</Label>
                      <Textarea
                        id={`item-${index}-description`}
                        placeholder="Detalles del trabajo..."
                        rows={2}
                        {...form.register(`items.${index}.description`)}
                      />
                    </Field>

                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <Label htmlFor={`item-${index}-date`}>Próximo servicio (fecha)</Label>
                        <Input
                          id={`item-${index}-date`}
                          type="date"
                          {...form.register(`items.${index}.next_service_date`)}
                        />
                      </Field>
                      <Field>
                        <Label htmlFor={`item-${index}-mileage`}>Próximo servicio (km)</Label>
                        <Input
                          id={`item-${index}-mileage`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="Ej: 55000"
                          {...form.register(`items.${index}.next_service_mileage`)}
                        />
                      </Field>
                    </div>
                  </div>
                ))}

                {form.formState.errors.items?.root && (
                  <FieldError>{form.formState.errors.items.root.message}</FieldError>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="space-y-4 pt-6">
                <Field>
                  <Label htmlFor="service-summary">Resumen del servicio</Label>
                  <Textarea
                    id="service-summary"
                    placeholder="Resumen general (opcional)"
                    rows={2}
                    {...form.register('summary')}
                  />
                  <FieldHint>Una síntesis breve facilita futuras consultas del historial.</FieldHint>
                </Field>
                <Button type="submit" size="lg" className="w-full" disabled={saving} aria-busy={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {saving ? 'Guardando…' : 'Registrar servicio'}
                </Button>
              </CardContent>
            </Card>
          </form>
        </>
      )}
    </div>
  )
}
