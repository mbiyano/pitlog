# PitLog

Sistema de gestión para talleres mecánicos con CRUD web y asistente de voz en español rioplatense.

## Componentes

| Directorio | Responsabilidad | Stack |
|---|---|---|
| `browser-app/` | UI, autenticación, CRUD, persistencia MCP y cliente WebRTC | Next.js 16, React 19, Supabase, Tailwind |
| `voice-gateway/` | Sesiones OpenAI Realtime, tokens efímeros, sideband y adaptadores MCP | Fastify 5, TypeScript, Zod, Vitest |

Supabase aporta PostgreSQL, Auth y RLS. El browser usa la sesión del usuario para el CRUD normal; las herramientas de voz pasan por una ruta autenticada y una capa de aplicación compartida.

## Flujo de voz activo

```text
Browser ── pide token efímero ──> voice-gateway ──> OpenAI Realtime
Browser <──────── token ───────── voice-gateway
Browser <════ audio + eventos WebRTC directos ═══> OpenAI Realtime
   │
   └── tool call autenticado ──> Next.js ──> Supabase
```

El gateway conserva también un flujo legado que relaya SDP y conecta un sideband WebSocket. La descripción detallada y los límites de seguridad están en [.claude/context/ARCHITECTURE.md](.claude/context/ARCHITECTURE.md).

## Inicio rápido

Requisitos: Node.js 20+, pnpm, Supabase y una API key de OpenAI con acceso a Realtime.

```bash
cd browser-app
pnpm install
cp .env.example .env

cd ../voice-gateway
pnpm install
cp .env.example .env
```

Completá las variables locales y, desde la raíz, ejecutá en terminales separadas:

```bash
pnpm dev:app
pnpm dev:gateway
```

La app queda en `http://localhost:3000` y el gateway en `http://localhost:8080`.

## Calidad

```bash
pnpm check
pnpm build
pnpm test
```

`check` ejecuta lint y typecheck en ambos servicios, además de los tests del gateway.

## Deploy

- `browser-app`: Vercel, con root directory `browser-app`.
- `voice-gateway`: Render mediante `render.yaml`.
- Supabase: aplicar en orden las migraciones de `browser-app/supabase/migrations/`.

Configurá `CORS_ALLOWED_ORIGINS` con el origen exacto de Vercel y usá el mismo `MCP_AUTH_TOKEN` en el gateway y el browser cuando el adaptador HTTP real esté activo. Los secretos nunca deben usar prefijo `NEXT_PUBLIC_`.

## Contexto para agentes

Leé [AGENTS.md](AGENTS.md) antes de modificar el repositorio. El contexto de producto, arquitectura y operación está versionado bajo `.claude/context/` y debe actualizarse junto con los cambios estructurales.
