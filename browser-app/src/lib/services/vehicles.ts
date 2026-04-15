import type { SupabaseClient } from '@supabase/supabase-js'
import type { Vehicle } from '@/lib/supabase/types'

type VehicleWithCustomer = Vehicle & {
  customers: { id: string; full_name: string; phone: string | null } | null
}

type VehicleDetail = Vehicle & {
  customers: { id: string; full_name: string; phone: string | null; email: string | null } | null
}

export async function getVehicles(
  supabase: SupabaseClient,
  search?: string
): Promise<VehicleWithCustomer[]> {
  let query = supabase
    .from('vehicles')
    .select('*, customers!inner(id, full_name, phone)')
    .order('updated_at', { ascending: false })

  if (search) {
    const upper = search.toUpperCase()
    query = query.or(`plate.ilike.%${upper}%,make.ilike.%${search}%,model.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data as VehicleWithCustomer[]
}

export async function getVehicleById(
  supabase: SupabaseClient,
  id: string
): Promise<VehicleDetail> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, customers(id, full_name, phone, email)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as VehicleDetail
}

export async function searchVehicleByPlate(
  supabase: SupabaseClient,
  plate: string
): Promise<VehicleWithCustomer[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, customers(id, full_name, phone)')
    .ilike('plate', `%${plate.toUpperCase().trim()}%`)
    .limit(10)

  if (error) throw error
  return data as VehicleWithCustomer[]
}

export async function createVehicle(
  supabase: SupabaseClient,
  data: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>
): Promise<Vehicle> {
  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({ ...data, plate: data.plate.toUpperCase().trim() })
    .select()
    .single()

  if (error) throw error
  return vehicle as Vehicle
}

export async function updateVehicle(
  supabase: SupabaseClient,
  id: string,
  data: Partial<Vehicle>
): Promise<Vehicle> {
  const updateData = { ...data }
  if (updateData.plate) updateData.plate = updateData.plate.toUpperCase().trim()

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return vehicle as Vehicle
}

export async function getVehicleCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}
