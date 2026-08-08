import 'server-only'

import { createClient } from '@supabase/supabase-js'

// Use service role for MCP operations (server-to-server, no user session)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function normalizePlate(rawPlate: unknown): string {
  const compact = String(rawPlate ?? '').toUpperCase().replace(/\s/g, '')

  if (/^[A-Z]{3}\d{3}$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`
  }
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(compact)) {
    return `${compact.slice(0, 2)} ${compact.slice(2, 5)} ${compact.slice(5)}`
  }

  throw new Error(`Patente inválida: "${compact}". Usá el formato ABC 123 o AB 123 CD`)
}

function plateCandidates(rawPlate: unknown): string[] {
  const canonical = normalizePlate(rawPlate)
  return [canonical, canonical.replace(/\s/g, '')]
}

function persistenceVerificationError(entity: string, id: string): Error {
  return new Error(`La base no confirmó la persistencia de ${entity} ${id}`)
}

function assertPersistedFields(
  entity: string,
  id: string,
  persisted: Record<string, unknown>,
  expected: Record<string, unknown>,
): void {
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (!Object.is(persisted[field], expectedValue)) {
      throw new Error(`La base no confirmó el campo ${field} de ${entity} ${id}`)
    }
  }
}

// ── Method handlers ─────────────────────────────────────────────────────────

async function buscarAutoPorPatente(params: Record<string, unknown>) {
  const candidates = plateCandidates(params.patente)
  const supabase = getSupabase()

  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, plate, make, model, year, customer_id')
    .in('plate', candidates)

  if (error) throw new Error(`No se pudo buscar la patente: ${error.message}`)

  const compact = candidates[0].replace(/\s/g, '')
  const match = (vehicles ?? []).find(
    (v: { plate: string }) => v.plate.toUpperCase().replace(/\s/g, '') === compact
  )

  if (!match) return null

  return {
    id: match.id,
    patente: match.plate,
    marca: match.make ?? '',
    modelo: match.model ?? '',
    anio: match.year ?? 0,
    clienteId: match.customer_id,
  }
}

async function crearAuto(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const plate = normalizePlate(params.patente)
  const customerId = params.clienteId as string | undefined

  if (!customerId) {
    throw new Error('clienteId es obligatorio para crear un vehículo')
  }

  const { data: existing, error: searchError } = await supabase
    .from('vehicles')
    .select('id, plate')
    .in('plate', plateCandidates(plate))
    .limit(1)

  if (searchError) throw new Error(`No se pudo verificar si la patente ya existe: ${searchError.message}`)
  if (existing?.length) {
    throw new Error(`Ya existe un vehículo con la patente ${existing[0].plate}`)
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      plate,
      make: (params.marca as string) ?? null,
      model: (params.modelo as string) ?? null,
      year: (params.anio as number) ?? null,
      customer_id: customerId,
      mileage_current: 0,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: persisted, error: verificationError } = await supabase
    .from('vehicles')
    .select('id, plate, make, model, year, customer_id')
    .eq('id', data.id)
    .single()

  if (verificationError || !persisted) throw persistenceVerificationError('el vehículo', data.id)
  assertPersistedFields('el vehículo', data.id, persisted, {
    plate,
    make: (params.marca as string) ?? null,
    model: (params.modelo as string) ?? null,
    year: (params.anio as number) ?? null,
    customer_id: customerId,
  })

  return {
    id: persisted.id,
    patente: persisted.plate,
    marca: persisted.make ?? '',
    modelo: persisted.model ?? '',
    anio: persisted.year ?? 0,
    clienteId: persisted.customer_id,
    persistenciaVerificada: true as const,
  }
}

async function actualizarAuto(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const autoId = String(params.autoId)

  const update: Record<string, unknown> = {}
  if (params.clienteId !== undefined) update.customer_id = params.clienteId
  if (params.marca !== undefined) update.make = params.marca
  if (params.modelo !== undefined) update.model = params.modelo
  if (params.anio !== undefined) update.year = params.anio
  if (params.kilometraje !== undefined) update.mileage_current = params.kilometraje

  if (Object.keys(update).length === 0) {
    throw new Error('No se proporcionaron campos para actualizar')
  }

  const { data, error } = await supabase
    .from('vehicles')
    .update(update)
    .eq('id', autoId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: persisted, error: verificationError } = await supabase
    .from('vehicles')
    .select('id, plate, make, model, year, customer_id, mileage_current')
    .eq('id', data.id)
    .single()

  if (verificationError || !persisted) throw persistenceVerificationError('el vehículo', data.id)
  assertPersistedFields('el vehículo', data.id, persisted, update)

  return {
    id: persisted.id,
    patente: persisted.plate,
    marca: persisted.make ?? '',
    modelo: persisted.model ?? '',
    anio: persisted.year ?? 0,
    clienteId: persisted.customer_id,
    kilometraje: persisted.mileage_current ?? 0,
    persistenciaVerificada: true as const,
  }
}

async function buscarCliente(params: Record<string, unknown>) {
  const query = String(params.query ?? '').toLowerCase()
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10)

  if (error) throw new Error(`No se pudo buscar el cliente: ${error.message}`)

  return (data ?? []).map((c: { id: string; full_name: string; phone: string | null; email: string | null }) => ({
    id: c.id,
    nombre: c.full_name,
    telefono: c.phone ?? undefined,
    email: c.email ?? undefined,
  }))
}

async function crearCliente(params: Record<string, unknown>) {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('customers')
    .insert({
      full_name: String(params.nombre ?? ''),
      phone: (params.telefono as string) ?? null,
      email: (params.email as string) ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: persisted, error: verificationError } = await supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .eq('id', data.id)
    .single()

  if (verificationError || !persisted) throw persistenceVerificationError('el cliente', data.id)
  assertPersistedFields('el cliente', data.id, persisted, {
    full_name: String(params.nombre ?? ''),
    phone: (params.telefono as string) ?? null,
    email: (params.email as string) ?? null,
  })

  return {
    id: persisted.id,
    nombre: persisted.full_name,
    telefono: persisted.phone ?? undefined,
    email: persisted.email ?? undefined,
    persistenciaVerificada: true as const,
  }
}

async function crearVisitaTaller(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const autoId = String(params.autoId)
  const visitDate = (params.fecha as string) ?? new Date().toISOString().split('T')[0]

  // Look up vehicle to get customer_id
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('customer_id')
    .eq('id', autoId)
    .single()

  if (vehicleError) throw new Error(`No se pudo verificar el vehículo: ${vehicleError.message}`)
  if (!vehicle) throw new Error(`Vehículo ${autoId} no encontrado`)

  const { data, error } = await supabase
    .from('service_visits')
    .insert({
      vehicle_id: autoId,
      customer_id: vehicle.customer_id,
      visit_date: visitDate,
      mileage: (params.kilometraje as number) ?? null,
      intake_notes: (params.observaciones as string) ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Update vehicle mileage if provided
  let advertencia: string | undefined
  if (params.kilometraje) {
    const { error: mileageError } = await supabase
      .from('vehicles')
      .update({ mileage_current: params.kilometraje as number })
      .eq('id', autoId)
      .lt('mileage_current', params.kilometraje as number)

    if (mileageError) {
      advertencia = `La visita se guardó, pero no se pudo actualizar el kilometraje del vehículo: ${mileageError.message}`
    }
  }

  const { data: persisted, error: verificationError } = await supabase
    .from('service_visits')
    .select('id, vehicle_id, customer_id, visit_date, mileage, intake_notes')
    .eq('id', data.id)
    .single()

  if (verificationError || !persisted) throw persistenceVerificationError('la visita', data.id)
  assertPersistedFields('la visita', data.id, persisted, {
    vehicle_id: autoId,
    customer_id: vehicle.customer_id,
    visit_date: visitDate,
    mileage: (params.kilometraje as number) ?? null,
    intake_notes: (params.observaciones as string) ?? null,
  })

  return {
    id: persisted.id,
    autoId: persisted.vehicle_id,
    clienteId: persisted.customer_id,
    fecha: persisted.visit_date,
    kilometraje: persisted.mileage ?? undefined,
    estado: 'abierta' as const,
    trabajos: [],
    persistenciaVerificada: true as const,
    ...(advertencia ? { advertencia } : {}),
  }
}

async function agregarTrabajoAVisita(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const visitaId = String(params.visitaId)

  if (params.costo !== undefined) {
    throw new Error('El costo no está soportado por el esquema actual y no se guardó')
  }

  const { data, error } = await supabase
    .from('service_items')
    .insert({
      visit_id: visitaId,
      category: 'general',
      title: String(params.descripcion ?? ''),
      description: (params.repuestos as string) ?? null,
      parts_used_json: params.repuestos ? [{ description: params.repuestos }] : [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: persisted, error: verificationError } = await supabase
    .from('service_items')
    .select('id, visit_id, title, description')
    .eq('id', data.id)
    .single()

  if (verificationError || !persisted) throw persistenceVerificationError('el trabajo', data.id)
  assertPersistedFields('el trabajo', data.id, persisted, {
    visit_id: visitaId,
    title: String(params.descripcion ?? ''),
    description: (params.repuestos as string) ?? null,
  })

  return {
    id: persisted.id,
    visitaId: persisted.visit_id,
    descripcion: persisted.title,
    repuestos: persisted.description ?? undefined,
    persistenciaVerificada: true as const,
  }
}

async function actualizarTrabajo(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const trabajoId = String(params.trabajoId)

  if (params.costo !== undefined || params.estado !== undefined) {
    throw new Error('El costo y el estado no están soportados por el esquema actual y no se guardaron')
  }

  const update: Record<string, unknown> = {}
  if (params.descripcion !== undefined) update.title = params.descripcion
  if (params.repuestos !== undefined) update.description = params.repuestos

  if (Object.keys(update).length === 0) {
    throw new Error('No se proporcionaron campos persistibles para actualizar')
  }

  const { data, error } = await supabase
    .from('service_items')
    .update(update)
    .eq('id', trabajoId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: persisted, error: verificationError } = await supabase
    .from('service_items')
    .select('id, visit_id, title, description')
    .eq('id', data.id)
    .single()

  if (verificationError || !persisted) throw persistenceVerificationError('el trabajo', data.id)
  assertPersistedFields('el trabajo', data.id, persisted, update)

  return {
    id: persisted.id,
    visitaId: persisted.visit_id,
    descripcion: persisted.title,
    repuestos: persisted.description ?? undefined,
    persistenciaVerificada: true as const,
  }
}

async function obtenerHistorialAuto(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const autoId = String(params.autoId)

  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('plate')
    .eq('id', autoId)
    .single()

  if (vehicleError) throw new Error(`No se pudo obtener el vehículo: ${vehicleError.message}`)
  if (!vehicle) throw new Error(`Vehículo ${autoId} no encontrado`)

  const { data: visits, error: visitsError } = await supabase
    .from('service_visits')
    .select('*, service_items(*)')
    .eq('vehicle_id', autoId)
    .order('visit_date', { ascending: false })

  if (visitsError) throw new Error(`No se pudo obtener el historial: ${visitsError.message}`)

  return {
    autoId,
    patente: vehicle.plate,
    visitas: (visits ?? []).map((v: { id: string; vehicle_id: string; customer_id: string; visit_date: string; mileage: number | null; service_items: Array<{ id: string; visit_id: string; title: string; description: string | null }> }) => ({
      id: v.id,
      autoId: v.vehicle_id,
      clienteId: v.customer_id,
      fecha: v.visit_date,
      kilometraje: v.mileage ?? undefined,
      estado: 'cerrada' as const,
      trabajos: (v.service_items ?? []).map((i: { id: string; visit_id: string; title: string; description: string | null }) => ({
        id: i.id,
        visitaId: i.visit_id,
        descripcion: i.title,
        repuestos: i.description ?? undefined,
        estado: 'terminado' as const,
      })),
    })),
  }
}

async function obtenerUltimoService(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const autoId = String(params.autoId)

  const { data: visits, error } = await supabase
    .from('service_visits')
    .select('*, service_items(title)')
    .eq('vehicle_id', autoId)
    .order('visit_date', { ascending: false })
    .limit(1)

  if (error) throw new Error(`No se pudo obtener el último service: ${error.message}`)

  const last = (visits ?? [])[0]
  if (!last) return null

  return {
    autoId,
    fecha: last.visit_date,
    kilometraje: last.mileage ?? undefined,
    trabajos: (last.service_items ?? []).map((i: { title: string }) => i.title),
  }
}

async function crearRecordatorioService(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const autoId = String(params.autoId)

  // Look up vehicle to get customer_id
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('customer_id')
    .eq('id', autoId)
    .single()

  if (vehicleError) throw new Error(`No se pudo verificar el vehículo: ${vehicleError.message}`)
  if (!vehicle) throw new Error(`Vehículo ${autoId} no encontrado`)

  const clienteId = (params.clienteId as string) ?? vehicle.customer_id

  const { data, error } = await supabase
    .from('service_reminders')
    .insert({
      vehicle_id: autoId,
      customer_id: clienteId,
      reason: String(params.tipo ?? 'service'),
      due_date: (params.fechaEstimada as string) ?? null,
      due_mileage: (params.kilometrajeEstimado as number) ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: persisted, error: verificationError } = await supabase
    .from('service_reminders')
    .select('id, vehicle_id, customer_id, reason, due_date, due_mileage, status')
    .eq('id', data.id)
    .single()

  if (verificationError || !persisted) throw persistenceVerificationError('el recordatorio', data.id)
  assertPersistedFields('el recordatorio', data.id, persisted, {
    vehicle_id: autoId,
    customer_id: clienteId,
    reason: String(params.tipo ?? 'service'),
    due_date: (params.fechaEstimada as string) ?? null,
    due_mileage: (params.kilometrajeEstimado as number) ?? null,
    status: 'pending',
  })

  return {
    id: persisted.id,
    autoId: persisted.vehicle_id,
    clienteId: persisted.customer_id,
    tipo: persisted.reason,
    fechaEstimada: persisted.due_date ?? '',
    kilometrajeEstimado: persisted.due_mileage ?? undefined,
    estado: 'pendiente' as const,
    persistenciaVerificada: true as const,
  }
}

async function listarRecordatoriosPendientes(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const clienteId = String(params.clienteId)

  const { data, error } = await supabase
    .from('service_reminders')
    .select('*')
    .eq('customer_id', clienteId)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })

  if (error) throw new Error(`No se pudieron listar los recordatorios: ${error.message}`)

  return (data ?? []).map((r: { id: string; vehicle_id: string; customer_id: string; reason: string; due_date: string | null; due_mileage: number | null; status: string }) => ({
    id: r.id,
    autoId: r.vehicle_id,
    clienteId: r.customer_id,
    tipo: r.reason,
    fechaEstimada: r.due_date ?? '',
    kilometrajeEstimado: r.due_mileage ?? undefined,
    estado: 'pendiente' as const,
  }))
}

async function redactarMensajeCliente(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const clienteId = String(params.clienteId)

  const { data: customer, error } = await supabase
    .from('customers')
    .select('full_name')
    .eq('id', clienteId)
    .single()

  if (error) throw new Error(`No se pudo obtener el cliente: ${error.message}`)
  if (!customer) throw new Error(`Cliente ${clienteId} no encontrado`)

  const nombre = customer?.full_name ?? 'cliente'
  const tipo = (params.tipo as string) ?? 'generico'
  const detalles = (params.detalles as string) ?? ''

  const mensajes: Record<string, string> = {
    recordatorio_service: `Hola ${nombre}, te recordamos que tu vehículo tiene un service pendiente. ¡Llamanos para coordinar un turno!`,
    confirmacion_turno: `Hola ${nombre}, confirmamos tu turno en el taller. Cualquier consulta, avisanos.`,
    presupuesto: `Hola ${nombre}, adjuntamos el presupuesto solicitado. Quedamos a disposición.`,
    generico: `Hola ${nombre}, nos comunicamos del taller. ${detalles}`,
  }

  return { mensaje: mensajes[tipo] ?? mensajes.generico }
}

// ── Method dispatch ─────────────────────────────────────────────────────────

// ── Logging helper ────────────────────────────────────────────────────────
function mcpLog(method: string, message: string, extra?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  console.log(JSON.stringify({ ts, layer: 'mcp', method, message, ...extra }))
}

const METHODS: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  buscar_auto_por_patente: buscarAutoPorPatente,
  crear_auto: crearAuto,
  actualizar_auto: actualizarAuto,
  buscar_cliente: buscarCliente,
  crear_cliente: crearCliente,
  crear_visita_taller: crearVisitaTaller,
  agregar_trabajo_a_visita: agregarTrabajoAVisita,
  actualizar_trabajo: actualizarTrabajo,
  obtener_historial_auto: obtenerHistorialAuto,
  obtener_ultimo_service: obtenerUltimoService,
  crear_recordatorio_service: crearRecordatorioService,
  listar_recordatorios_pendientes: listarRecordatoriosPendientes,
  redactar_mensaje_cliente: redactarMensajeCliente,
}

export function isMcpMethod(method: string): boolean {
  return Object.hasOwn(METHODS, method)
}

export async function executeMcpMethod(
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const handler = Object.hasOwn(METHODS, method) ? METHODS[method] : undefined
  if (!handler) throw new Error(`Unknown method: ${method}`)

  mcpLog(method, 'Executing')
  try {
    const result = await handler(params)
    mcpLog(method, 'Success', { resultId: (result as { id?: string })?.id })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    mcpLog(method, 'ERROR', { error: message })
    throw error
  }
}
