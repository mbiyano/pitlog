import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCustomers } from '@/lib/services/customers'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { Users, Plus, Phone, Mail, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { CustomerSearch } from './customer-search'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerSupabaseClient()
  const customers = await getCustomers(supabase, params.q)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={`${customers.length} cliente${customers.length !== 1 ? 's' : ''} registrado${customers.length !== 1 ? 's' : ''}`}
        actions={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/clientes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Link>
          </Button>
        }
      />

      <CustomerSearch initialQuery={params.q} />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes"
          description={
            params.q
              ? 'No se encontraron clientes con esa búsqueda'
              : 'Agregá tu primer cliente para comenzar'
          }
          action={
            !params.q && (
              <Button asChild>
                <Link href="/clientes/nuevo">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo cliente
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card/80 shadow-sm">
          {customers.map((customer) => {
            const vehicles = (customer.vehicles ?? []) as Array<{ id: string; plate: string }>
            return (
              <Link
                key={customer.id}
                href={`/clientes/${customer.id}`}
                className="flex min-h-16 items-center gap-4 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/70 focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{customer.full_name}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </span>
                    )}
                  </div>
                </div>
                {vehicles.length > 0 && (
                  <div className="hidden flex-wrap gap-1 sm:flex">
                    {vehicles.map((v) => (
                      <span
                        key={v.id}
                        className="rounded-md border bg-secondary px-2 py-1 font-mono text-xs font-bold tracking-wide"
                      >
                        {v.plate}
                      </span>
                    ))}
                  </div>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
