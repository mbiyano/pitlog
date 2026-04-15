import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getVehicleCount } from '@/lib/services/vehicles'
import { getVisitsThisMonth, getRecentVisits } from '@/lib/services/visits'
import { getDueRemindersCount, getUpcomingReminders } from '@/lib/services/reminders'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Car, Wrench, Bell, Clock } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { QuickSearch } from './quick-search'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const [vehicleCount, visitsThisMonth, dueReminders, upcomingReminders, recentVisits] =
    await Promise.all([
      getVehicleCount(supabase),
      getVisitsThisMonth(supabase),
      getDueRemindersCount(supabase),
      getUpcomingReminders(supabase, 5),
      getRecentVisits(supabase, 5),
    ])

  return (
    <div className="space-y-6">
      <PageHeader title="Panel" description="Vista general del taller" />

      {/* Quick search */}
      <QuickSearch />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Vehículos registrados"
          value={vehicleCount}
          icon={Car}
        />
        <StatCard
          title="Servicios este mes"
          value={visitsThisMonth}
          icon={Wrench}
        />
        <StatCard
          title="Recordatorios vencidos"
          value={dueReminders}
          icon={Bell}
          description={dueReminders > 0 ? 'Requieren atención' : 'Todo al día'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming reminders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Próximos recordatorios</CardTitle>
              <Link
                href="/recordatorios"
                className="text-sm text-primary hover:underline"
              >
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingReminders.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay recordatorios pendientes
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingReminders.map((r) => (
                  <Link
                    key={r.id}
                    href={`/vehiculos/${r.vehicle_id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {(r.vehicles as { plate: string })?.plate} — {r.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(r.customers as { full_name: string })?.full_name}
                      </p>
                    </div>
                    {r.due_date && (
                      <Badge
                        variant={
                          isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))
                            ? 'destructive'
                            : isToday(new Date(r.due_date))
                              ? 'warning'
                              : 'secondary'
                        }
                      >
                        {format(new Date(r.due_date), 'dd MMM', { locale: es })}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent visits */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Últimos servicios</CardTitle>
              <Link href="/vehiculos" className="text-sm text-primary hover:underline">
                Ver todos
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay servicios registrados
              </p>
            ) : (
              <div className="space-y-3">
                {recentVisits.map((v) => (
                  <Link
                    key={v.id}
                    href={`/vehiculos/${v.vehicle_id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {(v.vehicles as { plate: string; make: string | null; model: string | null })?.plate}
                        {' '}
                        {(v.vehicles as { make: string | null; model: string | null })?.make}{' '}
                        {(v.vehicles as { model: string | null })?.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(v.customers as { full_name: string })?.full_name}
                        {v.intake_notes && ` — ${v.intake_notes.slice(0, 60)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(v.visit_date), 'dd/MM/yy')}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
