export const VOICE_GATEWAY_URL =
  process.env.NEXT_PUBLIC_VOICE_GATEWAY_URL ?? 'http://localhost:8080'

/** Write tools must return database-verified persistence before reporting success. */
export const WRITE_TOOLS = new Set([
  'crear_auto',
  'actualizar_auto',
  'crear_cliente',
  'crear_visita_taller',
  'agregar_trabajo_a_visita',
  'actualizar_trabajo',
  'crear_recordatorio_service',
])
