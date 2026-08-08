# voice-gateway

Gateway Fastify de PitLog para crear sesiones OpenAI Realtime sin exponer la API key, aplicar políticas de tool calls y conectar un backend MCP real o simulado.

## Desarrollo

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Requiere Node.js 20+ y `OPENAI_API_KEY`. Escucha en `http://localhost:8080` por defecto.

## API

| Método y ruta | Uso |
|---|---|
| `GET /healthz` | salud y cantidad de sesiones activas |
| `POST /api/realtime/token` | crea una sesión y devuelve token efímero + modelo |
| `POST /api/realtime/session` | flujo legado: recibe SDP, lo relaya y devuelve SDP |
| `GET /api/realtime/session/:id` | estado sanitizado de sesión |
| `POST /api/realtime/session/:id/end` | finaliza la sesión |
| `GET /api/realtime/session/:id/events` | journal de depuración |

El flujo principal del browser usa `/api/realtime/token` y negocia SDP directamente con OpenAI. El flujo `/api/realtime/session` conserva el relay y conecta el sideband usando el `call_id` cuando OpenAI lo devuelve.

## Módulos

```text
src/
├── api/              Fastify, CORS, rate limit y rutas
├── config/           entorno validado con Zod
├── conversation/     estado y confirmaciones
├── mcp/              contratos, tools, adaptadores y factory
├── policies/         guardrails
├── realtime/         sesiones, prompt, config y sideband
└── observability/    logger y journal
```

`mcp-client.ts` mantiene imports históricos y reexporta los módulos enfocados. Para persistencia real configurá:

```env
USE_MOCK_MCP=false
MCP_SERVER_BASE_URL=http://localhost:3000/api
MCP_AUTH_TOKEN=un-secreto-compartido
```

El adaptador envía JSON-RPC a `${MCP_SERVER_BASE_URL}/mcp`.

## Seguridad

- `OPENAI_API_KEY` nunca se devuelve al browser.
- CORS respeta la lista exacta de `CORS_ALLOWED_ORIGINS`.
- La creación de sesiones tiene rate limit por IP.
- `GATEWAY_BEARER_TOKEN` protege las rutas salvo `/healthz` cuando se configura; un browser público no debe recibir ese secreto.
- Los logs redactan credenciales, tokens y SDP.
- Las escrituras procesadas por sideband pasan por `ConfirmationManager`.

## Verificación

```bash
pnpm check
pnpm build
pnpm test:coverage
```

La suite usa Vitest y mocks de OpenAI/WebSocket; no debe hacer requests reales.
