// ── Input / Output types ──────────────────────────────────────────────────────

export interface Auto {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  clienteId?: string;
  kilometraje?: number;
  persistenciaVerificada?: true;
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
  persistenciaVerificada?: true;
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
  persistenciaVerificada?: true;
  advertencia?: string;
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
  estado?: 'pendiente' | 'en_proceso' | 'terminado';
  persistenciaVerificada?: true;
}

export interface AddTrabajoInput {
  visitaId: string;
  descripcion: string;
  repuestos?: string;
}

export interface UpdateTrabajoInput {
  trabajoId: string;
  descripcion?: string;
  repuestos?: string;
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
  persistenciaVerificada?: true;
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
