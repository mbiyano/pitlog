# browser-app

Aplicación Next.js 16 de PitLog. Incluye autenticación Supabase, CRUD del taller, pantalla de voz, un endpoint autenticado para herramientas iniciadas en el browser y un endpoint MCP server-to-server.

## Desarrollo

```bash
pnpm install
cp .env.example .env
pnpm dev
```

La app corre en `http://localhost:3000`.

El sistema visual, los patrones de interacción y el checklist de accesibilidad están documentados en [`docs/UX_SYSTEM.md`](docs/UX_SYSTEM.md). Todo componente nuevo debe usar tokens semánticos y reutilizar las primitivas allí definidas.

Para preparar la base, aplicá en orden los archivos de `supabase/migrations/`. El seed opcional se ejecuta con `pnpm db:seed` y usa `SUPABASE_SERVICE_ROLE_KEY` solamente del lado servidor.

## Variables

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key protegida por RLS.
- `NEXT_PUBLIC_VOICE_GATEWAY_URL`: URL del gateway.
- `SUPABASE_SERVICE_ROLE_KEY`: acceso servidor para seed y métodos MCP.
- `MCP_AUTH_TOKEN`: bearer compartido para `/api/mcp`; es obligatorio en producción.

## Rutas principales

| Ruta | Función |
|---|---|
| `/dashboard` | métricas, búsqueda y actividad reciente |
| `/clientes` | clientes y vehículos asociados |
| `/vehiculos` | vehículos, detalle e historial |
| `/servicio/nuevo` | alta de visita con trabajos y recordatorios |
| `/recordatorios` | seguimiento de próximos servicios |
| `/voz` | sesión WebRTC con el asistente |
| `/api/voice/tool-call` | herramientas same-origin; requiere sesión Supabase |
| `/api/mcp` | JSON-RPC server-to-server; requiere bearer en producción |

## Estructura

```text
src/
├── app/                    rutas y transports HTTP
├── features/voice/         UI, WebRTC, protecciones y aplicación MCP
├── components/             primitives y componentes compartidos
└── lib/
    ├── services/           acceso Supabase para pantallas CRUD
    ├── supabase/           clientes, auth y tipos
    └── validations/        schemas Zod de formularios
```

La página `/voz` pide un token efímero al gateway en paralelo con el acceso al micrófono y luego negocia SDP directamente con OpenAI. Los eventos de herramienta vuelven por el data channel; una orden clara ejecuta la escritura sin una confirmación adicional, pero el resultado solo se informa como exitoso cuando Supabase verifica la persistencia.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm build
```

El frontend todavía no tiene runner de tests. Al agregar lógica nueva, mantenela pura y separada de los componentes para facilitar su futura cobertura.
