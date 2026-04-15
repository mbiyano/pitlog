import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceReminder } from '@/lib/supabase/types'

type ReminderWithRelations = ServiceReminder & {
  vehicles: { plate: string; make: string | null; model: string | null } | null
  customers: { full_name: string; phone: string | null } | null
}

export async function getReminders(
  supabase: SupabaseClient,
  filters?: {
    status?: string
    vehicleId?: string
    customerId?: string
  }
): Promise<ReminderWithRelations[]> {
  let query = supabase
    .from('service_reminders')
    .select('*, vehicles(plate, make, model), customers(full_name, phone)')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters?.vehicleId) {
    query = query.eq('vehicle_id', filters.vehicleId)
  }
  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as ReminderWithRelations[]
}

export async function getUpcomingReminders(
  supabase: SupabaseClient,
  limit = 10
): Promise<ReminderWithRelations[]> {
  const { data, error } = await supabase
    .from('service_reminders')
    .select('*, vehicles(plate, make, model), customers(full_name, phone)')
    .eq('status', 'pending')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return data as ReminderWithRelations[]
}

export async function getDueRemindersCount(supabase: SupabaseClient): Promise<number> {
  const today = new Date().toISOString().split('T')[0]

  const { count, error } = await supabase
    .from('service_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('due_date', today)

  if (error) throw error
  return count ?? 0
}

export async function updateReminderStatus(
  supabase: SupabaseClient,
  id: string,
  status: 'pending' | 'contacted' | 'done' | 'snoozed',
  dueDate?: string
): Promise<ServiceReminder> {
  const update: Record<string, unknown> = { status }
  if (dueDate) update.due_date = dueDate

  const { data, error } = await supabase
    .from('service_reminders')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServiceReminder
}

export async function getRemindersByVehicle(
  supabase: SupabaseClient,
  vehicleId: string
): Promise<ServiceReminder[]> {
  const { data, error } = await supabase
    .from('service_reminders')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('due_date', { ascending: true })

  if (error) throw error
  return data as ServiceReminder[]
}
