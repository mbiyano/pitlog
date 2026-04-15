import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getVehicleById } from '@/lib/services/vehicles'
import { getVisitsByVehicle } from '@/lib/services/visits'
import { getRemindersByVehicle } from '@/lib/services/reminders'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Car,
  Wrench,
  Calendar,
  Gauge,
  Bell,
  User,
  Phone,
  Clock,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { VehicleEditDialog } from './vehicle-edit-dialog'

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  let vehicle
  try {
    vehicle = await getVehicleById(supabase, id)
  } catch {
    notFound()
  }

  const [visits, reminders] = await Promise.all([
    getVisitsByVehicle(supabase, id),
    getRemindersByVehicle(supabase, id),
  ])

  const customer = vehicle.customers as {
    id: string
    full_name: string
    phone: string | null
    email: string | null
  } | null

  const lastVisit = visits[0] ?? null
  const lastOilChange = visits
    .flatMap((v) => (v.service_items as Array<{ category: string; created_at: string }>) ?? [])
    .find((item) => item.category === 'aceite')

  const pendingReminders = reminders.filter((r) => r.status === 'pending')

  return (
    <div className="space-y-6">
      <PageHeader
        title={vehicle.plate}
        description={[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
        actions={
          <div className="flex gap-2">
            <VehicleEditDialog vehicle={vehicle} />
            <Button asChild size="lg">
              <Link href={`/servicio/nuevo?vehicle_id=${vehicle.id}`}>
                <Wrench className="mr-2 h-4 w-4" />
                Nuevo servicio
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gauge className="h-4 w-4" />
                Kilometraje
              </span>
              <span className="font-bold">
                {new Intl.NumberFormat('es-AR').format(vehicle.mileage_current)} km
              </span>
            </div>
            {vehicle.engine && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Motor</span>
                <span className="text-sm">{vehicle.engine}</span>
              </div>
            )}
            {vehicle.vin && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">VIN</span>
                <span className="font-mono text-xs">{vehicle.vin}</span>
              </div>
            )}

            <Separator />

            {customer && (
              <Link
                href={`/clientes/${customer.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{customer.full_name}</p>
                  {customer.phone && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {customer.phone}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Último servicio</span>
                <span className="text-sm">
                  {lastVisit
                    ? format(new Date(lastVisit.visit_date), 'dd/MM/yyyy')
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Último cambio aceite</span>
                <span className="text-sm">
                  {lastOilChange
                    ? format(new Date(lastOilChange.created_at), 'dd/MM/yyyy')
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total servicios</span>
                <span className="text-sm font-bold">{visits.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline + reminders */}
        <div className="space-y-6 lg:col-span-2">
          {/* Reminders */}
          {pendingReminders.length > 0 && (
            <Card className="border-yellow-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4 text-yellow-500" />
                  Recordatorios pendientes ({pendingReminders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingReminders.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg bg-yellow-500/10 p-3"
                    >
                      <span className="text-sm">{r.reason}</span>
                      {r.due_date && (
                        <Badge variant="warning">
                          {format(new Date(r.due_date), 'dd MMM yyyy', { locale: es })}
                        </Badge>
                      )}
                      {r.due_mileage && (
                        <Badge variant="secondary">
                          {new Intl.NumberFormat('es-AR').format(r.due_mileage)} km
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service history timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de servicios</CardTitle>
            </CardHeader>
            <CardContent>
              {visits.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="Sin servicios registrados"
                  description="Registrá el primer servicio para este vehículo"
                  action={
                    <Button asChild>
                      <Link href={`/servicio/nuevo?vehicle_id=${vehicle.id}`}>
                        <Wrench className="mr-2 h-4 w-4" />
                        Nuevo servicio
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-[17px] top-2 h-[calc(100%-16px)] w-px bg-border" />

                  {visits.map((visit, idx) => {
                    const items = (visit.service_items ?? []) as Array<{
                      id: string
                      category: string
                      title: string
                      description: string | null
                    }>
                    return (
                      <div key={visit.id} className="relative flex gap-4 pb-8 last:pb-0">
                        {/* Timeline dot */}
                        <div className="relative z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-background">
                          <Wrench className="h-4 w-4 text-primary" />
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {format(new Date(visit.visit_date), "d 'de' MMMM yyyy", { locale: es })}
                              </span>
                              {visit.mileage && (
                                <Badge variant="secondary" className="text-xs">
                                  {new Intl.NumberFormat('es-AR').format(visit.mileage)} km
                                </Badge>
                              )}
                            </div>
                          </div>

                          {visit.intake_notes && (
                            <p className="text-sm text-muted-foreground">{visit.intake_notes}</p>
                          )}

                          {items.length > 0 && (
                            <div className="space-y-1 rounded-lg border p-3">
                              {items.map((item) => (
                                <div key={item.id} className="flex items-start gap-2">
                                  <Badge variant="outline" className="mt-0.5 shrink-0 text-xs">
                                    {item.category}
                                  </Badge>
                                  <div>
                                    <p className="text-sm font-medium">{item.title}</p>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {visit.summary && (
                            <p className="text-sm italic text-muted-foreground">
                              {visit.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
