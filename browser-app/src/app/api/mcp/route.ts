import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * MCP Server endpoint — JSON-RPC 2.0
 *
 * The voice-gateway's HttpMcpAdapter POSTs here.
 * Each JSON-RPC method maps to a Supabase operation on the shared database.
 *
 * Config in voice-gateway/.env:
 *   USE_MOCK_MCP=false
 *   MCP_SERVER_BASE_URL=http://localhost:3000/api
 *   MCP_AUTH_TOKEN=<same value as MCP_AUTH_TOKEN in browser-app .env>
 */

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? ''

// Use service role for MCP operations (server-to-server, no user session)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── JSON-RPC types ──────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: string
  method: string
  params: Record<string, unknown>
  id: number
}

function jsonRpcSuccess(id: number, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', result, id })
}

function jsonRpcError(id: number, message: string, status = 400) {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { message }, id },
    { status }
  )
}

// ── Method handlers ─────────────────────────────────────────────────────────

async function buscarAutoPorPatente(params: Record<string, unknown>) {
  const patente = String(params.patente ?? '').toUpperCase().replace(/\s/g, '')
  const supabase = getSupabase()

  // Search with spaces stripped for matching
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate, make, model, year, customer_id')
    .limit(10)

  // Manual match since plates may have different spacing
  const match = (vehicles ?? []).find(
    (v: { plate: string }) => v.plate.toUpperCase().replace(/\s/g, '') === patente
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
  const plate = String(params.patente ?? '').toUpperCase().trim()
  const customerId = params.clienteId as string | undefined

  // If no customer provided, try to find or create a generic one
  let resolvedCustomerId = customerId
  if (!resolvedCustomerId) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('full_name', 'Cliente sin asignar')
      .limit(1)
      .single()

    if (existing) {
      resolvedCustomerId = existing.id
    } else {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({ full_name: 'Cliente sin asignar' })
        .select('id')
        .single()
      resolvedCustomerId = newCustomer?.id
    }
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      plate,
      make: (params.marca as string) ?? null,
      model: (params.modelo as string) ?? null,
      year: (params.anio as number) ?? null,
      customer_id: resolvedCustomerId!,
      mileage_current: 0,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return {
    id: data.id,
    patente: data.plate,
    marca: data.make ?? '',
    modelo: data.model ?? '',
    anio: data.year ?? 0,
    clienteId: data.customer_id,
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

  return {
    id: data.id,
    patente: data.plate,
    marca: data.make ?? '',
    modelo: data.model ?? '',
    anio: data.year ?? 0,
    clienteId: data.customer_id,
  }
}

async function buscarCliente(params: Record<string, unknown>) {
  const query = String(params.query ?? '').toLowerCase()
  const supabase = getSupabase()

  const { data } = await supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10)

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

  return {
    id: data.id,
    nombre: data.full_name,
    telefono: data.phone ?? undefined,
    email: data.email ?? undefined,
  }
}

async function crearVisitaTaller(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const autoId = String(params.autoId)

  // Look up vehicle to get customer_id
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('customer_id')
    .eq('id', autoId)
    .single()

  if (!vehicle) throw new Error(`Vehículo ${autoId} no encontrado`)

  const { data, error } = await supabase
    .from('service_visits')
    .insert({
      vehicle_id: autoId,
      customer_id: vehicle.customer_id,
      visit_date: (params.fecha as string) ?? new Date().toISOString().split('T')[0],
      mileage: (params.kilometraje as number) ?? null,
      intake_notes: (params.observaciones as string) ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Update vehicle mileage if provided
  if (params.kilometraje) {
    await supabase
      .from('vehicles')
      .update({ mileage_current: params.kilometraje as number })
      .eq('id', autoId)
      .lt('mileage_current', params.kilometraje as number)
  }

  return {
    id: data.id,
    autoId: data.vehicle_id,
    clienteId: data.customer_id,
    fecha: data.visit_date,
    kilometraje: data.mileage ?? undefined,
    estado: 'abierta' as const,
    trabajos: [],
  }
}

async function agregarTrabajoAVisita(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const visitaId = String(params.visitaId)

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

  return {
    id: data.id,
    visitaId: data.visit_id,
    descripcion: data.title,
    repuestos: data.description ?? undefined,
    costo: (params.costo as number) ?? undefined,
    estado: 'pendiente' as const,
  }
}

async function actualizarTrabajo(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const trabajoId = String(params.trabajoId)

  const update: Record<string, unknown> = {}
  if (params.descripcion) update.title = params.descripcion
  if (params.repuestos) update.description = params.repuestos

  const { data, error } = await supabase
    .from('service_items')
    .update(update)
    .eq('id', trabajoId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return {
    id: data.id,
    visitaId: data.visit_id,
    descripcion: data.title,
    repuestos: data.description ?? undefined,
    estado: (params.estado as string) ?? 'pendiente',
  }
}

async function obtenerHistorialAuto(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const autoId = String(params.autoId)

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('plate')
    .eq('id', autoId)
    .single()

  if (!vehicle) throw new Error(`Vehículo ${autoId} no encontrado`)

  const { data: visits } = await supabase
    .from('service_visits')
    .select('*, service_items(*)')
    .eq('vehicle_id', autoId)
    .order('visit_date', { ascending: false })

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

  const { data: visits } = await supabase
    .from('service_visits')
    .select('*, service_items(title)')
    .eq('vehicle_id', autoId)
    .order('visit_date', { ascending: false })
    .limit(1)

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
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('customer_id')
    .eq('id', autoId)
    .single()

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

  return {
    id: data.id,
    autoId: data.vehicle_id,
    clienteId: data.customer_id,
    tipo: data.reason,
    fechaEstimada: data.due_date ?? '',
    kilometrajeEstimado: data.due_mileage ?? undefined,
    estado: 'pendiente' as const,
  }
}

async function listarRecordatoriosPendientes(params: Record<string, unknown>) {
  const supabase = getSupabase()
  const clienteId = String(params.clienteId)

  const { data } = await supabase
    .from('service_reminders')
    .select('*')
    .eq('customer_id', clienteId)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })

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

  const { data: customer } = await supabase
    .from('customers')
    .select('full_name')
    .eq('id', clienteId)
    .single()

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

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  if (MCP_AUTH_TOKEN) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${MCP_AUTH_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: JsonRpcRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { message: 'Invalid JSON' }, id: null },
      { status: 400 }
    )
  }

  const { method, params, id } = body

  const handler = METHODS[method]
  if (!handler) {
    mcpLog(method, 'Unknown method', { params })
    return jsonRpcError(id, `Unknown method: ${method}`, 400)
  }

  mcpLog(method, 'Executing', { params })

  try {
    const result = await handler(params ?? {})
    mcpLog(method, 'Success', { resultId: (result as { id?: string })?.id })
    return jsonRpcSuccess(id, result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    mcpLog(method, 'ERROR', { error: message, stack: err instanceof Error ? err.stack : undefined })
    return jsonRpcError(id, message, 500)
  }
}
