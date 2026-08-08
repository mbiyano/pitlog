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
    return { ...auto, persistenciaVerificada: true };
  }

  async actualizarAuto(data: UpdateAutoInput): Promise<Auto> {
    const auto = this.autos.get(data.autoId);
    if (!auto) throw new Error(`Auto ${data.autoId} no encontrado`);
    if (data.clienteId !== undefined) auto.clienteId = data.clienteId;
    if (data.marca !== undefined) auto.marca = data.marca;
    if (data.modelo !== undefined) auto.modelo = data.modelo;
    if (data.anio !== undefined) auto.anio = data.anio;
    if (data.kilometraje !== undefined) auto.kilometraje = data.kilometraje;
    return { ...auto, persistenciaVerificada: true };
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
    return { ...cliente, persistenciaVerificada: true };
  }

  async crearVisitaTaller(data: CreateVisitaInput): Promise<VisitaTaller> {
    const id = this.makeId('visita');
    const visita: VisitaTaller = { id, ...data, estado: 'abierta', trabajos: [] };
    this.visitas.set(id, visita);
    return { ...visita, persistenciaVerificada: true };
  }

  async agregarTrabajoAVisita(data: AddTrabajoInput): Promise<Trabajo> {
    const visita = this.visitas.get(data.visitaId);
    if (!visita) throw new Error(`Visita ${data.visitaId} no encontrada`);
    const id = this.makeId('trabajo');
    const trabajo: Trabajo = { ...data, id, estado: 'pendiente' };
    visita.trabajos.push(trabajo);
    return { ...trabajo, persistenciaVerificada: true };
  }

  async actualizarTrabajo(data: UpdateTrabajoInput): Promise<Trabajo> {
    for (const visita of this.visitas.values()) {
      const idx = visita.trabajos.findIndex((t) => t.id === data.trabajoId);
      if (idx !== -1) {
        const existing = visita.trabajos[idx]!;
        const updated: Trabajo = { ...existing, ...data, id: existing.id };
        visita.trabajos[idx] = updated;
        return { ...updated, persistenciaVerificada: true };
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
    return { ...recordatorio, persistenciaVerificada: true };
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
