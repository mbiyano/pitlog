'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateReminderStatus } from '@/lib/services/reminders'
import { format, isPast, isToday, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { useToast } from '@/components/ui/use-toast'
import {
  Bell,
  Phone,
  CheckCircle2,
  Clock,
  Car,
  User,
} from 'lucide-react'
import Link from 'next/link'

type Reminder = {
  id: string
  vehicle_id: string
  customer_id: string
  due_date: string | null
  due_mileage: number | null
  reason: string
  status: string
  vehicles: { plate: string; make: string | null; model: string | null } | null
  customers: { full_name: string; phone: string | null } | null
}

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'contacted', label: 'Contactados' },
  { value: 'snoozed', label: 'Pospuestos' },
  { value: 'done', label: 'Completados' },
  { value: 'all', label: 'Todos' },
]

export function ReminderList({
  initialReminders,
  currentFilter,
}: {
  initialReminders: Reminder[]
  currentFilter: string
}) {
  const [reminders, setReminders] = useState(initialReminders)
  const router = useRouter()
  const { toast } = useToast()

  async function handleStatusChange(
    id: string,
    status: 'pending' | 'contacted' | 'done' | 'snoozed',
    dueDate?: string
  ) {
    try {
      const supabase = createClient()
      await updateReminderStatus(supabase, id, status, dueDate)
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, ...(dueDate ? { due_date: dueDate } : {}) } : r))
      )
      toast({ title: 'Recordatorio actualizado' })
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    }
  }

  function getDueBadge(dueDate: string | null) {
    if (!dueDate) return null
    const date = new Date(dueDate)
    const isOverdue = isPast(date) && !isToday(date)
    const isDueToday = isToday(date)

    return (
      <Badge variant={isOverdue ? 'destructive' : isDueToday ? 'warning' : 'secondary'}>
        {isOverdue ? 'Vencido' : isDueToday ? 'Hoy' : format(date, 'dd MMM', { locale: es })}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={currentFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => router.replace(`/recordatorios?status=${f.value}`)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No hay recordatorios"
          description="No se encontraron recordatorios con este filtro"
        />
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => {
            const vehicle = r.vehicles as { plate: string; make: string | null; model: string | null } | null
            const customer = r.customers as { full_name: string; phone: string | null } | null

            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getDueBadge(r.due_date)}
                        {r.due_mileage && (
                          <Badge variant="outline">
                            {new Intl.NumberFormat('es-AR').format(r.due_mileage)} km
                          </Badge>
                        )}
                        <Badge
                          variant={
                            r.status === 'done'
                              ? 'success'
                              : r.status === 'contacted'
                                ? 'secondary'
                                : r.status === 'snoozed'
                                  ? 'outline'
                                  : 'default'
                          }
                        >
                          {STATUS_FILTERS.find((f) => f.value === r.status)?.label ?? r.status}
                        </Badge>
                      </div>
                      <p className="font-medium">{r.reason}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {vehicle && (
                          <Link
                            href={`/vehiculos/${r.vehicle_id}`}
                            className="flex items-center gap-1 hover:text-foreground hover:underline"
                          >
                            <Car className="h-3 w-3" />
                            <span className="font-mono font-bold">{vehicle.plate}</span>
                            {' '}{vehicle.make} {vehicle.model}
                          </Link>
                        )}
                        {customer && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {customer.full_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {r.status !== 'done' && (
                      <div className="flex flex-wrap gap-2">
                        {r.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(r.id, 'contacted')}
                          >
                            <Phone className="mr-1 h-3 w-3" />
                            Contactado
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newDate = addDays(new Date(), 7).toISOString().split('T')[0]
                            handleStatusChange(r.id, 'snoozed', newDate)
                          }}
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          +7 días
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(r.id, 'done')}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Hecho
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
