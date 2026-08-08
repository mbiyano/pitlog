import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getReminders } from '@/lib/services/reminders'
import { PageHeader } from '@/components/layout/page-header'
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

      <ReminderList
        initialReminders={reminders}
        currentFilter={params.status ?? 'pending'}
      />
    </div>
  )
}
