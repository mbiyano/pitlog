import { fetch } from 'undici';
import type { Logger } from '../observability/logger.js';
import type {
  AddTrabajoInput,
  Auto,
  Cliente,
  CreateAutoInput,
  CreateClienteInput,
  CreateRecordatorioInput,
  CreateVisitaInput,
  HistorialAuto,
  McpAdapter,
  RecordatorioService,
  RedactarMensajeInput,
  Trabajo,
  UltimoService,
  UpdateAutoInput,
  UpdateTrabajoInput,
  VisitaTaller,
} from './mcp-types.js';

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
