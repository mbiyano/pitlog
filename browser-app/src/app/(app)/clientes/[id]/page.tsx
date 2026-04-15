import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCustomerById } from '@/lib/services/customers'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, Mail, Car, Plus, Wrench, StickyNote } from 'lucide-react'
import Link from 'next/link'
import { CustomerEditDialog } from './customer-edit-dialog'
import { CustomerDeleteButton } from '../customer-delete-button'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  let customer
  try {
    customer = await getCustomerById(supabase, id)
  } catch {
    notFound()
  }

  const vehicles = (customer.vehicles ?? []) as Array<{
    id: string
    plate: string
    make: string | null
    model: string | null
    year: number | null
    mileage_current: number
  }>

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.full_name}
        description="Detalle de cliente"
        actions={
          <div className="flex items-center gap-2">
            <CustomerEditDialog customer={customer} />
            <CustomerDeleteButton
              customerId={customer.id}
              customerName={customer.full_name}
              vehicleCount={vehicles.length}
              redirectTo="/clientes"
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.phone ? (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${customer.phone}`} className="text-sm hover:underline">
                  {customer.phone}
                </a>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" /> Sin teléfono
              </p>
            )}
            {customer.email ? (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="text-sm hover:underline">
                  {customer.email}
                </a>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" /> Sin email
              </p>
            )}
            {customer.notes && (
              <div className="flex items-start gap-2 pt-2">
                <StickyNote className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicles */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Vehículos ({vehicles.length})
              </CardTitle>
              <Button size="sm" asChild>
                <Link href={`/vehiculos/nuevo?customer_id=${customer.id}`}>
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Este cliente no tiene vehículos registrados
              </p>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <Link
                    key={v.id}
                    href={`/vehiculos/${v.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-lg font-bold">{v.plate}</p>
                        <p className="text-sm text-muted-foreground">
                          {v.make} {v.model} {v.year}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {new Intl.NumberFormat('es-AR').format(v.mileage_current)} km
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick action */}
      <div className="flex gap-3">
        <Button asChild size="lg" variant="outline">
          <Link href={`/servicio/nuevo?customer_id=${customer.id}`}>
            <Wrench className="mr-2 h-4 w-4" />
            Nuevo servicio
          </Link>
        </Button>
      </div>
    </div>
  )
}
