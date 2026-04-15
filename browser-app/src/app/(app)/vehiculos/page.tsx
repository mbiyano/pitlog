import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getVehicles } from '@/lib/services/vehicles'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Car, Plus } from 'lucide-react'
import Link from 'next/link'
import { VehicleSearch } from './vehicle-search'

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerSupabaseClient()
  const vehicles = await getVehicles(supabase, params.q)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehículos"
        description={`${vehicles.length} vehículo${vehicles.length !== 1 ? 's' : ''}`}
        actions={
          <Button asChild size="lg">
            <Link href="/vehiculos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo vehículo
            </Link>
          </Button>
        }
      />

      <VehicleSearch initialQuery={params.q} />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No hay vehículos"
          description={
            params.q
              ? 'No se encontraron vehículos con esa búsqueda'
              : 'Registrá el primer vehículo'
          }
          action={
            !params.q && (
              <Button asChild>
                <Link href="/vehiculos/nuevo">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo vehículo
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {vehicles.map((vehicle) => {
            const customer = vehicle.customers as { id: string; full_name: string; phone: string | null } | null
            return (
              <Link
                key={vehicle.id}
                href={`/vehiculos/${vehicle.id}`}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Car className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold">{vehicle.plate}</p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.make} {vehicle.model} {vehicle.year}
                    </p>
                    {customer && (
                      <p className="text-xs text-muted-foreground">{customer.full_name}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">
                    {new Intl.NumberFormat('es-AR').format(vehicle.mileage_current)} km
                  </Badge>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
