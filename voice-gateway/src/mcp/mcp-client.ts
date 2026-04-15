import { fetch } from 'undici';
import type { Env } from '../config/env.js';
import type { Logger } from '../observability/logger.js';

// ── Input / Output types ──────────────────────────────────────────────────────

export interface Auto {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  clienteId?: string;
}

export interface CreateAutoInput {
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  clienteId?: string;
}

export interface UpdateAutoInput {
  autoId: string;
  clienteId?: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  kilometraje?: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
}

export interface CreateClienteInput {
  nombre: string;
  telefono?: string;
  email?: string;
}

export interface VisitaTaller {
  id: string;
  autoId: string;
  clienteId?: string;
  fecha: string;
  kilometraje?: number;
  estado: 'abierta' | 'cerrada';
  trabajos: Trabajo[];
}

export interface CreateVisitaInput {
  autoId: string;
  clienteId?: string;
  fecha: string;
  kilometraje?: number;
  observaciones?: string;
}

export interface Trabajo {
  id: string;
  visitaId: string;
  descripcion: string;
  repuestos?: string;
  costo?: number;
  estado: 'pendiente' | 'en_proceso' | 'terminado';
}

export interface AddTrabajoInput {
  visitaId: string;
  descripcion: string;
  repuestos?: string;
  costo?: number;
}

export interface UpdateTrabajoInput {
  trabajoId: string;
  descripcion?: string;
  repuestos?: string;
  costo?: number;
  estado?: 'pendiente' | 'en_proceso' | 'terminado';
}

export interface HistorialAuto {
  autoId: string;
  patente: string;
  visitas: VisitaTaller[];
}

export interface UltimoService {
  autoId: string;
  fecha: string;
  kilometraje?: number;
  trabajos: string[];
}

export interface RecordatorioService {
  id: string;
  autoId: string;
  clienteId?: string;
  tipo: string;
  fechaEstimada: string;
  kilometrajeEstimado?: number;
  estado: 'pendiente' | 'enviado' | 'completado';
}

export interface CreateRecordatorioInput {
  autoId: string;
  clienteId?: string;
  tipo: string;
  fechaEstimada: string;
  kilometrajeEstimado?: number;
}

export interface RedactarMensajeInput {
  clienteId: string;
  autoId?: string;
  tipo: 'recordatorio_service' | 'confirmacion_turno' | 'presupuesto' | 'generico';
  detalles?: string;
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface McpAdapter {
  buscarAutoPorPatente(patente: string): Promise<Auto | null>;
  crearAuto(data: CreateAutoInput): Promise<Auto>;
  actualizarAuto(data: UpdateAutoInput): Promise<Auto>;
  buscarCliente(query: string): Promise<Cliente[]>;
  crearCliente(data: CreateClienteInput): Promise<Cliente>;
  crearVisitaTaller(data: CreateVisitaInput): Promise<VisitaTaller>;
  agregarTrabajoAVisita(data: AddTrabajoInput): Promise<Trabajo>;
  actualizarTrabajo(data: UpdateTrabajoInput): Promise<Trabajo>;
  obtenerHistorialAuto(autoId: string): Promise<HistorialAuto>;
  obtenerUltimoService(autoId: string): Promise<UltimoService | null>;
  crearRecordatorioService(data: CreateRecordatorioInput): Promise<RecordatorioService>;
  listarRecordatoriosPendientes(clienteId: string): Promise<RecordatorioService[]>;
  redactarMensajeCliente(data: RedactarMensajeInput): Promise<{ mensaje: string }>;
}

// ── HTTP adapter (real MCP server) ────────────────────────────────────────────

export class HttpMcpAdapter implements McpAdapter {
  private readonly baseUrl: string;
  private readonly authToken: string;

  constructor(baseUrl: string, authToken: string, private readonly log: Logger) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authToken = authToken;
  }

  private async call<T>(method: string, params: unknown): Promise<T> {
    const start = Date.now();
    const url = `${this.baseUrl}/mcp`;
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() });

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body,
      });
    } catch (err) {
      this.log.error({ method, err }, 'MCP HTTP request failed');
      throw new Error(`MCP request failed: ${(err as Error).message}`);
    }

    const elapsed = Date.now() - start;
    this.log.debug({ method, status: res.status, elapsed }, 'MCP call');

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MCP server returned ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { result?: T; error?: { message: string } };
    if (json.error) {
      throw new Error(`MCP error: ${json.error.message}`);
    }
    return json.result as T;
  }

  async buscarAutoPorPatente(patente: string): Promise<Auto | null> {
    return this.call('buscar_auto_por_patente', { patente });
  }

  async crearAuto(data: CreateAutoInput): Promise<Auto> {
    return this.call('crear_auto', data);
  }

  async actualizarAuto(data: UpdateAutoInput): Promise<Auto> {
    return this.call('actualizar_auto', data);
  }

  async buscarCliente(query: string): Promise<Cliente[]> {
    return this.call('buscar_cliente', { query });
  }

  async crearCliente(data: CreateClienteInput): Promise<Cliente> {
    return this.call('crear_cliente', data);
  }

  async crearVisitaTaller(data: CreateVisitaInput): Promise<VisitaTaller> {
    return this.call('crear_visita_taller', data);
  }

  async agregarTrabajoAVisita(data: AddTrabajoInput): Promise<Trabajo> {
    return this.call('agregar_trabajo_a_visita', data);
  }

  async actualizarTrabajo(data: UpdateTrabajoInput): Promise<Trabajo> {
    return this.call('actualizar_trabajo', data);
  }

  async obtenerHistorialAuto(autoId: string): Promise<HistorialAuto> {
    return this.call('obtener_historial_auto', { autoId });
  }

  async obtenerUltimoService(autoId: string): Promise<UltimoService | null> {
    return this.call('obtener_ultimo_service', { autoId });
  }

  async crearRecordatorioService(data: CreateRecordatorioInput): Promise<RecordatorioService> {
    return this.call('crear_recordatorio_service', data);
  }

  async listarRecordatoriosPendientes(clienteId: string): Promise<RecordatorioService[]> {
    return this.call('listar_recordatorios_pendientes', { clienteId });
  }

  async redactarMensajeCliente(data: RedactarMensajeInput): Promise<{ mensaje: string }> {
    return this.call('redactar_mensaje_cliente', data);
  }
}

// ── Mock adapter (in-memory, for local dev/testing) ───────────────────────────

export class MockMcpAdapter implements McpAdapter {
  private autos = new Map<string, Auto>([
    [
      'auto-1',
      {
        id: 'auto-1',
        patente: 'ABC123',
        marca: 'Ford',
        modelo: 'Falcon',
        anio: 1978,
        clienteId: 'cliente-1',
      },
    ],
    [
      'auto-2',
      {
        id: 'auto-2',
        patente: 'AB123CD',
        marca: 'Volkswagen',
        modelo: 'Gol',
        anio: 2015,
        clienteId: 'cliente-2',
      },
    ],
    [
      'auto-3',
      {
        id: 'auto-3',
        patente: 'XY456ZW',
        marca: 'Renault',
        modelo: 'Sandero',
        anio: 2020,
        clienteId: 'cliente-1',
      },
    ],
  ]);

  private clientes = new Map<string, Cliente>([
    ['cliente-1', { id: 'cliente-1', nombre: 'Juan Pérez', telefono: '1154321234' }],
    ['cliente-2', { id: 'cliente-2', nombre: 'María García', telefono: '1167890123' }],
  ]);

  private visitas = new Map<string, VisitaTaller>([
    [
      'visita-1',
      {
        id: 'visita-1',
        autoId: 'auto-1',
        clienteId: 'cliente-1',
        fecha: '2024-11-15',
        kilometraje: 85000,
        estado: 'cerrada',
        trabajos: [
          {
            id: 'trabajo-1',
            visitaId: 'visita-1',
            descripcion: 'Cambio de aceite y filtro',
            costo: 15000,
            estado: 'terminado',
          },
        ],
      },
    ],
  ]);

  private recordatorios = new Map<string, RecordatorioService>();

  private nextId = 100;
  private makeId(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }

  async buscarAutoPorPatente(patente: string): Promise<Auto | null> {
    const normalized = patente.toUpperCase().replace(/\s/g, '');
    for (const auto of this.autos.values()) {
      if (auto.patente.toUpperCase().replace(/\s/g, '') === normalized) {
        return auto;
      }
    }
    return null;
  }

  async crearAuto(data: CreateAutoInput): Promise<Auto> {
    const id = this.makeId('auto');
    const auto: Auto = { id, ...data };
    this.autos.set(id, auto);
    return auto;
  }

  async actualizarAuto(data: UpdateAutoInput): Promise<Auto> {
    const auto = this.autos.get(data.autoId);
    if (!auto) throw new Error(`Auto ${data.autoId} no encontrado`);
    if (data.clienteId !== undefined) auto.clienteId = data.clienteId;
    if (data.marca !== undefined) auto.marca = data.marca;
    if (data.modelo !== undefined) auto.modelo = data.modelo;
    if (data.anio !== undefined) auto.anio = data.anio;
    return auto;
  }

  async buscarCliente(query: string): Promise<Cliente[]> {
    const q = query.toLowerCase();
    return Array.from(this.clientes.values()).filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.telefono?.includes(q) ||
        c.email?.toLowerCase().includes(q),
    );
  }

  async crearCliente(data: CreateClienteInput): Promise<Cliente> {
    const id = this.makeId('cliente');
    const cliente: Cliente = { id, ...data };
    this.clientes.set(id, cliente);
    return cliente;
  }

  async crearVisitaTaller(data: CreateVisitaInput): Promise<VisitaTaller> {
    const id = this.makeId('visita');
    const visita: VisitaTaller = { id, ...data, estado: 'abierta', trabajos: [] };
    this.visitas.set(id, visita);
    return visita;
  }

  async agregarTrabajoAVisita(data: AddTrabajoInput): Promise<Trabajo> {
    const visita = this.visitas.get(data.visitaId);
    if (!visita) throw new Error(`Visita ${data.visitaId} no encontrada`);
    const id = this.makeId('trabajo');
    const trabajo: Trabajo = { ...data, id, estado: 'pendiente' };
    visita.trabajos.push(trabajo);
    return trabajo;
  }

  async actualizarTrabajo(data: UpdateTrabajoInput): Promise<Trabajo> {
    for (const visita of this.visitas.values()) {
      const idx = visita.trabajos.findIndex((t) => t.id === data.trabajoId);
      if (idx !== -1) {
        const existing = visita.trabajos[idx]!;
        const updated: Trabajo = { ...existing, ...data, id: existing.id };
        visita.trabajos[idx] = updated;
        return updated;
      }
    }
    throw new Error(`Trabajo ${data.trabajoId} no encontrado`);
  }

  async obtenerHistorialAuto(autoId: string): Promise<HistorialAuto> {
    const auto = this.autos.get(autoId);
    if (!auto) throw new Error(`Auto ${autoId} no encontrado`);
    const visitas = Array.from(this.visitas.values()).filter((v) => v.autoId === autoId);
    return { autoId, patente: auto.patente, visitas };
  }

  async obtenerUltimoService(autoId: string): Promise<UltimoService | null> {
    const visitasAuto = Array.from(this.visitas.values())
      .filter((v) => v.autoId === autoId && v.estado === 'cerrada')
      .sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

    const ultima = visitasAuto[0];
    if (!ultima) return null;

    const service: UltimoService = {
      autoId,
      fecha: ultima.fecha,
      trabajos: ultima.trabajos.map((t) => t.descripcion),
    };
    if (ultima.kilometraje !== undefined) {
      service.kilometraje = ultima.kilometraje;
    }
    return service;
  }

  async crearRecordatorioService(data: CreateRecordatorioInput): Promise<RecordatorioService> {
    const id = this.makeId('recordatorio');
    const recordatorio: RecordatorioService = { id, ...data, estado: 'pendiente' };
    this.recordatorios.set(id, recordatorio);
    return recordatorio;
  }

  async listarRecordatoriosPendientes(clienteId: string): Promise<RecordatorioService[]> {
    return Array.from(this.recordatorios.values()).filter(
      (r) => r.clienteId === clienteId && r.estado === 'pendiente',
    );
  }

  async redactarMensajeCliente(data: RedactarMensajeInput): Promise<{ mensaje: string }> {
    const cliente = this.clientes.get(data.clienteId);
    const nombre = cliente?.nombre ?? 'cliente';
    const mensajes: Record<RedactarMensajeInput['tipo'], string> = {
      recordatorio_service: `Hola ${nombre}, te recordamos que tu vehículo tiene un service pendiente. ¡Llamanos para coordinar un turno!`,
      confirmacion_turno: `Hola ${nombre}, confirmamos tu turno en el taller. Cualquier consulta, avisanos.`,
      presupuesto: `Hola ${nombre}, adjuntamos el presupuesto solicitado. Quedamos a disposición.`,
      generico: `Hola ${nombre}, nos comunicamos del taller. ${data.detalles ?? ''}`,
    };
    return { mensaje: mensajes[data.tipo] };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createMcpAdapter(cfg: Env, log: Logger): McpAdapter {
  if (cfg.USE_MOCK_MCP) {
    log.info('Using MockMcpAdapter (USE_MOCK_MCP=true)');
    return new MockMcpAdapter();
  }

  if (!cfg.MCP_SERVER_BASE_URL) {
    throw new Error('MCP_SERVER_BASE_URL is required when USE_MOCK_MCP=false');
  }

  log.info({ baseUrl: cfg.MCP_SERVER_BASE_URL }, 'Using HttpMcpAdapter');
  return new HttpMcpAdapter(cfg.MCP_SERVER_BASE_URL, cfg.MCP_AUTH_TOKEN ?? '', log);
}
