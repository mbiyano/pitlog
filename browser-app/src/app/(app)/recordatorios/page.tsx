import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getReminders } from '@/lib/services/reminders'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Bell } from 'lucide-react'
import { ReminderList } from './reminder-list'

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerSupabaseClient()
  const reminders = await getReminders(supabase, {
    status: params.status ?? 'pending',
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recordatorios"
        description="Gestionar recordatorios de servicio"
      />

      {reminders.length === 0 && !params.status ? (
        <EmptyState
          icon={Bell}
          title="No hay recordatorios"
          description="Los recordatorios se crean automáticamente al registrar servicios con próximo mantenimiento"
        />
      ) : (
        <ReminderList
          initialReminders={reminders}
          currentFilter={params.status ?? 'pending'}
        />
      )}
    </div>
  )
}
