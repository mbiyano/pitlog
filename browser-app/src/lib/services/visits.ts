import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceVisit, ServiceItem, VisitNote } from '@/lib/supabase/types'
import type { ServiceVisitFormData } from '@/lib/validations'

type VisitWithItems = ServiceVisit & {
  service_items: ServiceItem[]
  visit_notes: VisitNote[]
}

type VisitWithRelations = ServiceVisit & {
  vehicles: { plate: string; make: string | null; model: string | null } | null
  customers: { full_name: string } | null
}

type VisitDetail = ServiceVisit & {
  service_items: ServiceItem[]
  visit_notes: VisitNote[]
  vehicles: { plate: string; make: string | null; model: string | null } | null
  customers: { full_name: string } | null
}

export async function getVisitsByVehicle(
  supabase: SupabaseClient,
  vehicleId: string
): Promise<VisitWithItems[]> {
  const { data, error } = await supabase
    .from('service_visits')
    .select('*, service_items(*), visit_notes(*)')
    .eq('vehicle_id', vehicleId)
    .order('visit_date', { ascending: false })

  if (error) throw error
  return data as VisitWithItems[]
}

export async function getVisitById(
  supabase: SupabaseClient,
  id: string
): Promise<VisitDetail> {
  const { data, error } = await supabase
    .from('service_visits')
    .select('*, service_items(*), visit_notes(*), vehicles(plate, make, model), customers(full_name)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as VisitDetail
}

export async function getRecentVisits(
  supabase: SupabaseClient,
  limit = 10
): Promise<VisitWithRelations[]> {
  const { data, error } = await supabase
    .from('service_visits')
    .select('*, vehicles(plate, make, model), customers(full_name)')
    .order('visit_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as VisitWithRelations[]
}

export async function getVisitsThisMonth(supabase: SupabaseClient): Promise<number> {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const { count, error } = await supabase
    .from('service_visits')
    .select('*', { count: 'exact', head: true })
    .gte('visit_date', firstDay)

  if (error) throw error
  return count ?? 0
}

export async function createVisitWithItems(
  supabase: SupabaseClient,
  data: ServiceVisitFormData,
  createdBy?: string
): Promise<ServiceVisit> {
  const { items, ...visitData } = data

  // Create the visit
  const { data: visit, error: visitError } = await supabase
    .from('service_visits')
    .insert({
      ...visitData,
      created_by: createdBy ?? null,
    })
    .select()
    .single()

  if (visitError) throw visitError

  // Create service items
  const itemsToInsert = items.map((item) => ({
    visit_id: (visit as ServiceVisit).id,
    category: item.category,
    title: item.title,
    description: item.description ?? null,
    parts_used_json: item.parts_used_json ?? [],
    next_service_date: item.next_service_date ?? null,
    next_service_mileage: item.next_service_mileage ?? null,
  }))

  const { data: serviceItems, error: itemsError } = await supabase
    .from('service_items')
    .insert(itemsToInsert)
    .select()

  if (itemsError) throw itemsError

  // Auto-generate reminders for items with next_service info
  const reminders = (serviceItems as ServiceItem[])
    .filter((item) => item.next_service_date || item.next_service_mileage)
    .map((item) => ({
      vehicle_id: data.vehicle_id,
      customer_id: data.customer_id,
      source_visit_id: (visit as ServiceVisit).id,
      due_date: item.next_service_date,
      due_mileage: item.next_service_mileage,
      reason: `${item.title} - próximo servicio`,
      status: 'pending' as const,
    }))

  if (reminders.length > 0) {
    const { error: remindersError } = await supabase
      .from('service_reminders')
      .insert(reminders)

    if (remindersError) throw remindersError
  }

  // Update vehicle mileage if provided and greater than current
  if (data.mileage) {
    await supabase
      .from('vehicles')
      .update({ mileage_current: data.mileage })
      .eq('id', data.vehicle_id)
      .lt('mileage_current', data.mileage)
  }

  return visit as ServiceVisit
}
