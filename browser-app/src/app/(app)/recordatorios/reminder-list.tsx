'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateReminderStatus } from '@/lib/services/reminders'
import { format, isPast, isToday, addDays, parseISO } from 'date-fns'
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  snoozed: 'Pospuesto',
  done: 'Completado',
}

export function ReminderList({
  initialReminders,
  currentFilter,
}: {
  initialReminders: Reminder[]
  currentFilter: string
}) {
  const [reminders, setReminders] = useState(initialReminders)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const router = useRouter()
  const { toast } = useToast()

  async function handleStatusChange(
    id: string,
    status: 'pending' | 'contacted' | 'done' | 'snoozed',
    dueDate?: string
  ) {
    setUpdatingIds((current) => new Set(current).add(id))
    try {
      const supabase = createClient()
      await updateReminderStatus(supabase, id, status, dueDate)
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, ...(dueDate ? { due_date: dueDate } : {}) } : r))
      )
      toast({ title: 'Recordatorio actualizado', description: STATUS_LABELS[status] })
    } catch {
      toast({ title: 'No se pudo actualizar', description: 'Intentá nuevamente.', variant: 'destructive' })
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  function getDueBadge(dueDate: string | null) {
    if (!dueDate) return null
    const date = parseISO(dueDate)
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
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filtrar recordatorios">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={currentFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => router.replace(`/recordatorios?status=${f.value}`)}
            role="tab"
            aria-selected={currentFilter === f.value}
            className="shrink-0"
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
              <Card key={r.id} className="transition-colors hover:border-primary/25">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                          {STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <p className="font-medium">{r.reason}</p>
                      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
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
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {r.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(r.id, 'contacted')}
                            disabled={updatingIds.has(r.id)}
                          >
                            <Phone className="mr-1 h-3 w-3" />
                            Contactado
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newDate = format(addDays(new Date(), 7), 'yyyy-MM-dd')
                            handleStatusChange(r.id, 'snoozed', newDate)
                          }}
                          disabled={updatingIds.has(r.id)}
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          +7 días
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(r.id, 'done')}
                          disabled={updatingIds.has(r.id)}
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
