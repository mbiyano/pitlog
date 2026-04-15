import type { SupabaseClient } from '@supabase/supabase-js'
import type { Customer } from '@/lib/supabase/types'

type CustomerWithVehicles = Customer & {
  vehicles: Array<{ id: string; plate: string; make: string | null; model: string | null }>
}

type CustomerDetail = Customer & {
  vehicles: Array<{
    id: string; plate: string; make: string | null; model: string | null
    year: number | null; mileage_current: number
  }>
}

export async function getCustomers(
  supabase: SupabaseClient,
  search?: string
): Promise<CustomerWithVehicles[]> {
  let query = supabase
    .from('customers')
    .select('*, vehicles(id, plate, make, model)')
    .order('updated_at', { ascending: false })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data as CustomerWithVehicles[]
}

export async function getCustomerById(
  supabase: SupabaseClient,
  id: string
): Promise<CustomerDetail> {
  const { data, error } = await supabase
    .from('customers')
    .select('*, vehicles(id, plate, make, model, year, mileage_current)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as CustomerDetail
}

export async function createCustomer(
  supabase: SupabaseClient,
  data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
): Promise<Customer> {
  const { data: customer, error } = await supabase
    .from('customers')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return customer as Customer
}

export async function updateCustomer(
  supabase: SupabaseClient,
  id: string,
  data: Partial<Customer>
): Promise<Customer> {
  const { data: customer, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return customer as Customer
}

export async function deleteCustomer(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}
