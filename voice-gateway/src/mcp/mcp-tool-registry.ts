import { z } from 'zod';
import type {
  McpAdapter,
  Auto,
  Cliente,
  VisitaTaller,
  Trabajo,
  HistorialAuto,
  UltimoService,
  RecordatorioService,
} from './mcp-client.js';

// ── Argentine plate validation ────────────────────────────────────────────────

// Old format: ABC 123 / ABC123
// New Mercosur format: AB 123 CD / AB123CD
const PLATE_REGEX = /^[A-Z]{2,3}\s?\d{3}\s?[A-Z]{0,2}$/i;

const plateSchema = z.string().transform((v) => v.toUpperCase().replace(/\s/g, '')).refine(
  (v) => PLATE_REGEX.test(v),
  (v) => ({ message: `Patente inválida: "${v}". Formatos válidos: ABC 123 o AB 123 CD` }),
);

// ── Zod schemas per tool ──────────────────────────────────────────────────────

export const TOOL_ZOD_SCHEMAS = {
  buscar_auto_por_patente: z.object({
    patente: plateSchema,
  }),

  crear_auto: z.object({
    patente: plateSchema,
    marca: z.string().min(1).max(50),
    modelo: z.string().min(1).max(50),
    anio: z.number().int().min(1900).max(new Date().getFullYear() + 1),
    clienteId: z.string().min(1),
  }),

  actualizar_auto: z.object({
    autoId: z.string().min(1),
    clienteId: z.string().optional(),
    marca: z.string().min(1).max(50).optional(),
    modelo: z.string().min(1).max(50).optional(),
    anio: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
    kilometraje: z.number().int().min(0).max(2_000_000).optional(),
  }),

  buscar_cliente: z.object({
    query: z.string().min(1).max(100),
  }),

  crear_cliente: z.object({
    nombre: z.string().min(2).max(100),
    telefono: z
      .string()
      .regex(/^\d{7,15}$/, 'Teléfono debe tener entre 7 y 15 dígitos')
      .optional(),
    email: z.string().email().optional(),
  }),

  crear_visita_taller: z.object({
    autoId: z.string().min(1),
    clienteId: z.string().optional(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
    kilometraje: z.number().int().min(0).max(2_000_000).optional(),
    observaciones: z.string().max(500).optional(),
  }),

  agregar_trabajo_a_visita: z.object({
    visitaId: z.string().min(1),
    descripcion: z.string().min(1).max(300),
    repuestos: z.string().max(300).optional(),
    costo: z.number().min(0).max(10_000_000).optional(),
  }),

  actualizar_trabajo: z.object({
    trabajoId: z.string().min(1),
    descripcion: z.string().min(1).max(300).optional(),
    repuestos: z.string().max(300).optional(),
    costo: z.number().min(0).max(10_000_000).optional(),
    estado: z.enum(['pendiente', 'en_proceso', 'terminado']).optional(),
  }),

  obtener_historial_auto: z.object({
    autoId: z.string().min(1),
  }),

  obtener_ultimo_service: z.object({
    autoId: z.string().min(1),
  }),

  crear_recordatorio_service: z.object({
    autoId: z.string().min(1),
    clienteId: z.string().optional(),
    tipo: z.string().min(1).max(50),
    fechaEstimada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
    kilometrajeEstimado: z.number().int().min(0).max(2_000_000).optional(),
  }),

  listar_recordatorios_pendientes: z.object({
    clienteId: z.string().min(1),
  }),

  redactar_mensaje_cliente: z.object({
    clienteId: z.string().min(1),
    autoId: z.string().optional(),
    tipo: z.enum(['recordatorio_service', 'confirmacion_turno', 'presupuesto', 'generico']),
    detalles: z.string().max(300).optional(),
  }),
} as const;

export type ToolName = keyof typeof TOOL_ZOD_SCHEMAS;

export const WRITE_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  'crear_auto',
  'actualizar_auto',
  'crear_cliente',
  'crear_visita_taller',
  'agregar_trabajo_a_visita',
  'actualizar_trabajo',
  'crear_recordatorio_service',
]);

export const READ_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  'buscar_auto_por_patente',
  'buscar_cliente',
  'obtener_historial_auto',
  'obtener_ultimo_service',
  'listar_recordatorios_pendientes',
  'redactar_mensaje_cliente',
]);

export const ALL_TOOL_NAMES = new Set<string>([...WRITE_TOOLS, ...READ_TOOLS]);

// ── OpenAI Realtime tool definitions (JSON Schema format) ─────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    name: 'buscar_auto_por_patente',
    description:
      'Busca un auto en el taller por su patente. Devuelve los datos del vehículo si existe.',
    parameters: {
      type: 'object',
      properties: {
        patente: {
          type: 'string',
          description: 'Patente del vehículo. Formatos válidos: ABC 123 o AB 123 CD.',
        },
      },
      required: ['patente'],
    },
  },
  {
    type: 'function' as const,
    name: 'crear_auto',
    description:
      'Registra un auto nuevo en el taller. Requiere clienteId obligatorio — primero buscá o creá al cliente. Requiere confirmación explícita del mecánico.',
    parameters: {
      type: 'object',
      properties: {
        patente: { type: 'string', description: 'Patente del vehículo.' },
        marca: { type: 'string', description: 'Marca del vehículo (ej: Ford, Volkswagen).' },
        modelo: { type: 'string', description: 'Modelo del vehículo (ej: Gol, Focus).' },
        anio: { type: 'number', description: 'Año de fabricación.' },
        clienteId: { type: 'string', description: 'ID del cliente propietario. OBLIGATORIO — buscá o creá al cliente primero.' },
      },
      required: ['patente', 'marca', 'modelo', 'anio', 'clienteId'],
    },
  },
  {
    type: 'function' as const,
    name: 'actualizar_auto',
    description:
      'Actualiza datos de un auto existente (marca, modelo, año, kilometraje o cliente asignado). Requiere confirmación explícita.',
    parameters: {
      type: 'object',
      properties: {
        autoId: { type: 'string', description: 'ID del auto a actualizar.' },
        clienteId: { type: 'string', description: 'Nuevo ID de cliente propietario.' },
        marca: { type: 'string', description: 'Nueva marca.' },
        modelo: { type: 'string', description: 'Nuevo modelo.' },
        anio: { type: 'number', description: 'Nuevo año de fabricación.' },
        kilometraje: { type: 'number', description: 'Kilometraje actual.' },
      },
      required: ['autoId'],
    },
  },
  {
    type: 'function' as const,
    name: 'buscar_cliente',
    description: 'Busca clientes por nombre, teléfono o email.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nombre, teléfono o email a buscar.' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function' as const,
    name: 'crear_cliente',
    description: 'Registra un cliente nuevo. Requiere confirmación explícita.',
    parameters: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre completo del cliente.' },
        telefono: { type: 'string', description: 'Teléfono (solo dígitos).' },
        email: { type: 'string', description: 'Email del cliente.' },
      },
      required: ['nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'crear_visita_taller',
    description: 'Registra una nueva visita al taller para un vehículo. Requiere confirmación.',
    parameters: {
      type: 'object',
      properties: {
        autoId: { type: 'string', description: 'ID del auto.' },
        clienteId: { type: 'string', description: 'ID del cliente (opcional).' },
        fecha: { type: 'string', description: 'Fecha de la visita en formato YYYY-MM-DD.' },
        kilometraje: { type: 'number', description: 'Kilometraje del auto al ingresar.' },
        observaciones: { type: 'string', description: 'Notas iniciales del mecánico.' },
      },
      required: ['autoId', 'fecha'],
    },
  },
  {
    type: 'function' as const,
    name: 'agregar_trabajo_a_visita',
    description:
      'Agrega un trabajo realizado a una visita existente. Requiere confirmación.',
    parameters: {
      type: 'object',
      properties: {
        visitaId: { type: 'string', description: 'ID de la visita.' },
        descripcion: { type: 'string', description: 'Descripción del trabajo realizado.' },
        repuestos: { type: 'string', description: 'Repuestos utilizados (opcional).' },
        costo: { type: 'number', description: 'Costo en pesos (opcional).' },
      },
      required: ['visitaId', 'descripcion'],
    },
  },
  {
    type: 'function' as const,
    name: 'actualizar_trabajo',
    description: 'Actualiza el estado o datos de un trabajo registrado. Requiere confirmación.',
    parameters: {
      type: 'object',
      properties: {
        trabajoId: { type: 'string', description: 'ID del trabajo a actualizar.' },
        descripcion: { type: 'string', description: 'Nueva descripción.' },
        repuestos: { type: 'string', description: 'Repuestos actualizados.' },
        costo: { type: 'number', description: 'Costo actualizado.' },
        estado: {
          type: 'string',
          enum: ['pendiente', 'en_proceso', 'terminado'],
          description: 'Nuevo estado del trabajo.',
        },
      },
      required: ['trabajoId'],
    },
  },
  {
    type: 'function' as const,
    name: 'obtener_historial_auto',
    description: 'Devuelve el historial completo de visitas y trabajos de un vehículo.',
    parameters: {
      type: 'object',
      properties: {
        autoId: { type: 'string', description: 'ID del auto.' },
      },
      required: ['autoId'],
    },
  },
  {
    type: 'function' as const,
    name: 'obtener_ultimo_service',
    description: 'Devuelve los datos del último service registrado para un vehículo.',
    parameters: {
      type: 'object',
      properties: {
        autoId: { type: 'string', description: 'ID del auto.' },
      },
      required: ['autoId'],
    },
  },
  {
    type: 'function' as const,
    name: 'crear_recordatorio_service',
    description: 'Crea un recordatorio de service para un vehículo. Requiere confirmación.',
    parameters: {
      type: 'object',
      properties: {
        autoId: { type: 'string', description: 'ID del auto.' },
        clienteId: { type: 'string', description: 'ID del cliente (opcional).' },
        tipo: { type: 'string', description: 'Tipo de service (ej: cambio de aceite).' },
        fechaEstimada: { type: 'string', description: 'Fecha estimada en formato YYYY-MM-DD.' },
        kilometrajeEstimado: {
          type: 'number',
          description: 'Kilometraje estimado para el service.',
        },
      },
      required: ['autoId', 'tipo', 'fechaEstimada'],
    },
  },
  {
    type: 'function' as const,
    name: 'listar_recordatorios_pendientes',
    description: 'Lista los recordatorios de service pendientes de un cliente.',
    parameters: {
      type: 'object',
      properties: {
        clienteId: { type: 'string', description: 'ID del cliente.' },
      },
      required: ['clienteId'],
    },
  },
  {
    type: 'function' as const,
    name: 'redactar_mensaje_cliente',
    description:
      'Genera un mensaje de texto listo para enviar al cliente (recordatorio, presupuesto, etc.).',
    parameters: {
      type: 'object',
      properties: {
        clienteId: { type: 'string', description: 'ID del cliente.' },
        autoId: { type: 'string', description: 'ID del auto relacionado (opcional).' },
        tipo: {
          type: 'string',
          enum: ['recordatorio_service', 'confirmacion_turno', 'presupuesto', 'generico'],
          description: 'Tipo de mensaje a redactar.',
        },
        detalles: { type: 'string', description: 'Información adicional para el mensaje.' },
      },
      required: ['clienteId', 'tipo'],
    },
  },
];

// ── Tool dispatcher ───────────────────────────────────────────────────────────

export type ToolResult =
  | Auto
  | Auto[]
  | Cliente
  | Cliente[]
  | VisitaTaller
  | Trabajo
  | HistorialAuto
  | UltimoService
  | RecordatorioService
  | RecordatorioService[]
  | { mensaje: string }
  | null;

export interface DispatchResult {
  success: boolean;
  result?: ToolResult;
  error?: string;
}

export async function dispatchTool(
  name: string,
  rawArgs: unknown,
  adapter: McpAdapter,
): Promise<DispatchResult> {
  if (!ALL_TOOL_NAMES.has(name)) {
    return { success: false, error: `Tool "${name}" is not registered` };
  }

  const toolName = name as ToolName;
  const schema = TOOL_ZOD_SCHEMAS[toolName];
  const parsed = schema.safeParse(rawArgs);

  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { success: false, error: `Validation failed: ${errors}` };
  }

  try {
    let result: ToolResult;
    const args = parsed.data;

    switch (toolName) {
      case 'buscar_auto_por_patente':
        result = await adapter.buscarAutoPorPatente(
          (args as z.infer<typeof TOOL_ZOD_SCHEMAS.buscar_auto_por_patente>).patente,
        );
        break;
      case 'crear_auto':
        result = await adapter.crearAuto(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.crear_auto>,
        );
        break;
      case 'actualizar_auto':
        result = await adapter.actualizarAuto(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.actualizar_auto>,
        );
        break;
      case 'buscar_cliente':
        result = await adapter.buscarCliente(
          (args as z.infer<typeof TOOL_ZOD_SCHEMAS.buscar_cliente>).query,
        );
        break;
      case 'crear_cliente':
        result = await adapter.crearCliente(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.crear_cliente>,
        );
        break;
      case 'crear_visita_taller':
        result = await adapter.crearVisitaTaller(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.crear_visita_taller>,
        );
        break;
      case 'agregar_trabajo_a_visita':
        result = await adapter.agregarTrabajoAVisita(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.agregar_trabajo_a_visita>,
        );
        break;
      case 'actualizar_trabajo':
        result = await adapter.actualizarTrabajo(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.actualizar_trabajo>,
        );
        break;
      case 'obtener_historial_auto':
        result = await adapter.obtenerHistorialAuto(
          (args as z.infer<typeof TOOL_ZOD_SCHEMAS.obtener_historial_auto>).autoId,
        );
        break;
      case 'obtener_ultimo_service':
        result = await adapter.obtenerUltimoService(
          (args as z.infer<typeof TOOL_ZOD_SCHEMAS.obtener_ultimo_service>).autoId,
        );
        break;
      case 'crear_recordatorio_service':
        result = await adapter.crearRecordatorioService(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.crear_recordatorio_service>,
        );
        break;
      case 'listar_recordatorios_pendientes':
        result = await adapter.listarRecordatoriosPendientes(
          (args as z.infer<typeof TOOL_ZOD_SCHEMAS.listar_recordatorios_pendientes>).clienteId,
        );
        break;
      case 'redactar_mensaje_cliente':
        result = await adapter.redactarMensajeCliente(
          args as z.infer<typeof TOOL_ZOD_SCHEMAS.redactar_mensaje_cliente>,
        );
        break;
    }

    return { success: true, result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function buildConfirmationSummaryEs(toolName: ToolName, args: unknown): string {
  const a = args as Record<string, unknown>;
  switch (toolName) {
    case 'crear_auto':
      return `Registrar auto ${String(a['patente'] ?? '')} ${String(a['marca'] ?? '')} ${String(a['modelo'] ?? '')} ${String(a['anio'] ?? '')}.`;
    case 'actualizar_auto':
      return `Actualizar auto ID ${String(a['autoId'] ?? '')}${a['clienteId'] ? ` → cliente: ${String(a['clienteId'])}` : ''}${a['marca'] ? ` → marca: ${String(a['marca'])}` : ''}${a['modelo'] ? ` → modelo: ${String(a['modelo'])}` : ''}.`;
    case 'crear_cliente':
      return `Registrar cliente "${String(a['nombre'] ?? '')}"${a['telefono'] ? `, teléfono ${String(a['telefono'])}` : ''}.`;
    case 'crear_visita_taller':
      return `Crear visita para el auto ID ${String(a['autoId'] ?? '')} el ${String(a['fecha'] ?? '')}${a['kilometraje'] ? ` con ${String(a['kilometraje'])} km` : ''}.`;
    case 'agregar_trabajo_a_visita':
      return `Agregar trabajo: "${String(a['descripcion'] ?? '')}"${a['costo'] ? ` — $${String(a['costo'])}` : ''}.`;
    case 'actualizar_trabajo':
      return `Actualizar trabajo ID ${String(a['trabajoId'] ?? '')}${a['estado'] ? ` → estado: ${String(a['estado'])}` : ''}.`;
    case 'crear_recordatorio_service':
      return `Crear recordatorio de ${String(a['tipo'] ?? 'service')} para fecha ${String(a['fechaEstimada'] ?? '')}.`;
    default:
      return `Ejecutar ${toolName} con los datos indicados.`;
  }
}
