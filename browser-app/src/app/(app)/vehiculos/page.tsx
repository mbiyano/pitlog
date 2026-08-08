import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getVehicles } from '@/lib/services/vehicles'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Car, ChevronRight, Plus } from 'lucide-react'
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
          <Button asChild size="lg" className="w-full sm:w-auto">
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => {
            const customer = vehicle.customers as { id: string; full_name: string; phone: string | null } | null
            return (
              <Link
                key={vehicle.id}
                href={`/vehiculos/${vehicle.id}`}
                className="interactive-row flex min-w-0 items-center gap-3 p-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Car className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-lg font-bold tracking-wide">{vehicle.plate}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {vehicle.make} {vehicle.model} {vehicle.year}
                    </p>
                    {customer && (
                      <p className="truncate text-xs text-muted-foreground">{customer.full_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">
                    {new Intl.NumberFormat('es-AR').format(vehicle.mileage_current)} km
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
