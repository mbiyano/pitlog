/**
 * Seed script — populates the database with realistic test data.
 *
 * Usage:
 *   pnpm db:seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seed() {
  console.log('Seeding database...')

  // --- Customers ---
  const customers = [
    { full_name: 'Carlos Rodríguez', phone: '+54 11 5555-0001', email: 'carlos@email.com', notes: 'Cliente habitual, siempre trae el Gol' },
    { full_name: 'María González', phone: '+54 11 5555-0002', email: 'maria@email.com', notes: null },
    { full_name: 'Jorge Martínez', phone: '+54 11 5555-0003', email: null, notes: 'Prefiere que lo llamen por WhatsApp' },
    { full_name: 'Ana López', phone: '+54 11 5555-0004', email: 'ana.lopez@email.com', notes: null },
    { full_name: 'Roberto Fernández', phone: '+54 11 5555-0005', email: null, notes: 'Tiene 3 vehículos' },
  ]

  const { data: insertedCustomers, error: custErr } = await supabase
    .from('customers')
    .insert(customers)
    .select()

  if (custErr) { console.error('Customer insert error:', custErr); return }
  console.log(`  Inserted ${insertedCustomers.length} customers`)

  // --- Vehicles ---
  const vehicles = [
    { customer_id: insertedCustomers[0].id, plate: 'ABC 123', make: 'Volkswagen', model: 'Gol Trend', year: 2018, engine: '1.6 8v', mileage_current: 67000 },
    { customer_id: insertedCustomers[1].id, plate: 'AB 123 CD', make: 'Toyota', model: 'Etios', year: 2020, engine: '1.5', mileage_current: 42000 },
    { customer_id: insertedCustomers[2].id, plate: 'DEF 456', make: 'Ford', model: 'Ka', year: 2017, engine: '1.5', mileage_current: 89000 },
    { customer_id: insertedCustomers[3].id, plate: 'GH 789 IJ', make: 'Chevrolet', model: 'Onix', year: 2021, engine: '1.2 Turbo', mileage_current: 28000 },
    { customer_id: insertedCustomers[4].id, plate: 'JKL 789', make: 'Fiat', model: 'Cronos', year: 2019, engine: '1.3', mileage_current: 55000 },
    { customer_id: insertedCustomers[4].id, plate: 'MN 456 OP', make: 'Renault', model: 'Kangoo', year: 2015, engine: '1.6', mileage_current: 120000 },
    { customer_id: insertedCustomers[4].id, plate: 'QRS 321', make: 'Peugeot', model: '208', year: 2022, engine: '1.6', mileage_current: 15000 },
  ]

  const { data: insertedVehicles, error: vehErr } = await supabase
    .from('vehicles')
    .insert(vehicles)
    .select()

  if (vehErr) { console.error('Vehicle insert error:', vehErr); return }
  console.log(`  Inserted ${insertedVehicles.length} vehicles`)

  // --- Service Visits ---
  const visits = [
    {
      vehicle_id: insertedVehicles[0].id,
      customer_id: insertedCustomers[0].id,
      visit_date: '2025-12-15',
      mileage: 65000,
      intake_notes: 'Viene por service completo de los 60.000 km',
      summary: 'Se realizó service completo. Motor en buen estado.',
    },
    {
      vehicle_id: insertedVehicles[0].id,
      customer_id: insertedCustomers[0].id,
      visit_date: '2026-03-10',
      mileage: 67000,
      intake_notes: 'Ruido en frenos delanteros',
      summary: 'Se cambiaron pastillas y discos delanteros.',
    },
    {
      vehicle_id: insertedVehicles[1].id,
      customer_id: insertedCustomers[1].id,
      visit_date: '2026-02-20',
      mileage: 40000,
      intake_notes: 'Cambio de aceite y filtros',
      summary: 'Aceite sintético 5W30, filtro de aceite y aire nuevos.',
    },
    {
      vehicle_id: insertedVehicles[2].id,
      customer_id: insertedCustomers[2].id,
      visit_date: '2026-01-05',
      mileage: 88000,
      intake_notes: 'Problema con el arranque en frío',
      summary: 'Se cambió batería y bujías. Problema resuelto.',
    },
    {
      vehicle_id: insertedVehicles[3].id,
      customer_id: insertedCustomers[3].id,
      visit_date: '2026-03-20',
      mileage: 28000,
      intake_notes: 'Service de los 30.000 km (adelantado)',
      summary: 'Service preventivo completo.',
    },
  ]

  const { data: insertedVisits, error: visitErr } = await supabase
    .from('service_visits')
    .insert(visits)
    .select()

  if (visitErr) { console.error('Visit insert error:', visitErr); return }
  console.log(`  Inserted ${insertedVisits.length} visits`)

  // --- Service Items ---
  const items = [
    // Visit 1: Gol Trend service completo
    { visit_id: insertedVisits[0].id, category: 'aceite', title: 'Cambio de aceite y filtro', description: 'Aceite Castrol 10W40 semi-sintético + filtro Mann', next_service_date: '2026-06-15', next_service_mileage: 75000 },
    { visit_id: insertedVisits[0].id, category: 'general', title: 'Filtro de aire', description: 'Filtro de aire nuevo' },
    { visit_id: insertedVisits[0].id, category: 'refrigeracion', title: 'Cambio de refrigerante', description: 'Refrigerante verde al 50%' },
    // Visit 2: Gol Trend frenos
    { visit_id: insertedVisits[1].id, category: 'frenos', title: 'Pastillas delanteras', description: 'Pastillas Ferodo', next_service_mileage: 87000 },
    { visit_id: insertedVisits[1].id, category: 'frenos', title: 'Discos delanteros', description: 'Discos ventilados Fremax' },
    // Visit 3: Etios aceite
    { visit_id: insertedVisits[2].id, category: 'aceite', title: 'Cambio de aceite sintético', description: 'Mobil 1 5W30 + filtro', next_service_date: '2026-08-20', next_service_mileage: 50000 },
    { visit_id: insertedVisits[2].id, category: 'general', title: 'Filtro de aire y habitáculo', description: 'Ambos filtros nuevos' },
    // Visit 4: Ford Ka
    { visit_id: insertedVisits[3].id, category: 'electricidad', title: 'Cambio de batería', description: 'Batería Moura 12V 65Ah' },
    { visit_id: insertedVisits[3].id, category: 'motor', title: 'Cambio de bujías', description: '4 bujías NGK' },
    // Visit 5: Onix service
    { visit_id: insertedVisits[4].id, category: 'aceite', title: 'Cambio de aceite', description: 'Aceite sintético 5W30', next_service_date: '2026-09-20', next_service_mileage: 38000 },
    { visit_id: insertedVisits[4].id, category: 'neumaticos', title: 'Rotación de cubiertas', description: 'Se rotaron las 4 cubiertas' },
  ]

  const { data: insertedItems, error: itemErr } = await supabase
    .from('service_items')
    .insert(items)
    .select()

  if (itemErr) { console.error('Item insert error:', itemErr); return }
  console.log(`  Inserted ${insertedItems.length} service items`)

  // --- Reminders ---
  const reminders = [
    {
      vehicle_id: insertedVehicles[0].id,
      customer_id: insertedCustomers[0].id,
      source_visit_id: insertedVisits[0].id,
      due_date: '2026-06-15',
      due_mileage: 75000,
      reason: 'Cambio de aceite y filtro - próximo servicio',
      status: 'pending',
    },
    {
      vehicle_id: insertedVehicles[0].id,
      customer_id: insertedCustomers[0].id,
      source_visit_id: insertedVisits[1].id,
      due_mileage: 87000,
      reason: 'Pastillas delanteras - próximo servicio',
      status: 'pending',
    },
    {
      vehicle_id: insertedVehicles[1].id,
      customer_id: insertedCustomers[1].id,
      source_visit_id: insertedVisits[2].id,
      due_date: '2026-08-20',
      due_mileage: 50000,
      reason: 'Cambio de aceite sintético - próximo servicio',
      status: 'pending',
    },
    {
      vehicle_id: insertedVehicles[3].id,
      customer_id: insertedCustomers[3].id,
      source_visit_id: insertedVisits[4].id,
      due_date: '2026-09-20',
      due_mileage: 38000,
      reason: 'Cambio de aceite - próximo servicio',
      status: 'pending',
    },
    {
      vehicle_id: insertedVehicles[2].id,
      customer_id: insertedCustomers[2].id,
      due_date: '2026-03-01',
      reason: 'Revisión general — hace más de 3 meses sin venir',
      status: 'pending',
    },
  ]

  const { data: insertedReminders, error: remErr } = await supabase
    .from('service_reminders')
    .insert(reminders)
    .select()

  if (remErr) { console.error('Reminder insert error:', remErr); return }
  console.log(`  Inserted ${insertedReminders.length} reminders`)

  // --- Visit Notes ---
  const notes = [
    { visit_id: insertedVisits[0].id, body: 'El cliente mencionó que también escucha un ruido al girar a la derecha. Revisar en próxima visita.' },
    { visit_id: insertedVisits[1].id, body: 'Los discos estaban bastante desgastados. Se recomendó revisar los traseros en la próxima visita.' },
  ]

  const { data: insertedNotes, error: notesErr } = await supabase
    .from('visit_notes')
    .insert(notes)
    .select()

  if (notesErr) { console.error('Notes insert error:', notesErr); return }
  console.log(`  Inserted ${insertedNotes.length} visit notes`)

  console.log('\nSeed completed successfully!')
}

seed().catch(console.error)
