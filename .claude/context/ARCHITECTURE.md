# Current architecture

## Deployable units

```text
Authenticated browser
  ├─ Next.js UI ────────────────> Supabase (anon key + RLS)
  ├─ /api/voice/tool-call ──────> shared MCP methods ─> Supabase (service role)
  └─ WebRTC audio/data ─────────> OpenAI Realtime
             │
             └─ token request ──> Fastify voice-gateway

voice-gateway
  ├─ creates OpenAI Realtime sessions and ephemeral tokens
  ├─ owns assistant instructions and tool definitions
  ├─ supports an optional Realtime sideband controller
  └─ dispatches through a mock or HTTP MCP adapter

HTTP MCP adapter ───────────────> Next.js /api/mcp ─> shared MCP methods
```

The repository contains two deployables, not a package workspace. The root `package.json` is an orchestration layer for checks and builds; each service retains its own lockfile and dependencies.

## Active voice flow

1. `/voz` renders `features/voice/components/voice-console.tsx`.
2. `useVoiceSession` requests microphone access and `POST /api/realtime/token` concurrently, then creates the peer connection and `oai-events` data channel.
3. After creating the SDP offer, the browser waits only for the first ICE candidate (or 300 ms), rather than waiting for full ICE gathering.
4. The gateway creates an OpenAI Realtime session using the shared config in `realtime-session-config.ts`, stores local session state, and returns an ephemeral token plus model name.
5. The browser sends its SDP directly to OpenAI with that ephemeral token. Audio and Realtime data events then flow directly between browser and OpenAI.
6. The browser receives tool-call events. Reads execute immediately; writes first pass the explicit-confirmation guard.
7. The browser posts the tool to the same-origin authenticated `/api/voice/tool-call` route.
8. That route invokes `features/voice/server/mcp-methods.ts` directly. Writes are read back from Supabase and only return `persistenciaVerificada: true` after the row is found; the browser rejects any unverified write result before returning it to the model.

`POST /api/realtime/session` remains as a legacy gateway-relayed SDP flow. The sideband controller is used by that path and is also the home of server-side confirmation/guardrail behavior. Do not assume the sideband is active in the browser-direct token flow.

Plate lookup normalizes legacy and Mercosur formats and queries exact canonical/compact candidates. Database lookup errors are failures, not “not found” results; this prevents a read outage from triggering accidental duplicate creation.
The browser-direct tool guard requires the immediately preceding assistant turn to be a plate read-back question before `buscar_auto_por_patente` can execute. It tracks confirmed plates and requires two confirmed misses for the same normalized plate before `crear_auto` can execute.

## Frontend boundaries

- `src/app/`: routing, layouts, and thin API transports.
- `src/features/voice/`: voice UI, WebRTC hook, confirmation guard, client tool adapter, and server MCP application service.
- `src/components/ui/`: generic UI primitives.
- `src/components/forms/`, `layout/`, `shared/`: reusable application components.
- `docs/UX_SYSTEM.md`: semantic design tokens, interaction patterns, accessibility rules, and the checklist for new frontend components.
- `src/lib/services/`: Supabase data access for CRUD screens.
- `src/lib/validations/`: Zod form schemas.
- `src/lib/supabase/`: browser/server clients, auth cookie refresh, and database types.
- `supabase/migrations/`: schema and RLS truth.

Server-only modules under `features/voice/server/` may use the service-role key. Never import them into a client component.

## Gateway boundaries

- `src/api/`: Fastify composition and transport routes.
- `src/config/`: parsed and validated environment.
- `src/conversation/`: session state and confirmation lifecycle.
- `src/mcp/`: integration DTOs, tool schemas/definitions/dispatch, mock adapter, HTTP adapter, and factory.
- `src/policies/`: tool-call guardrails.
- `src/realtime/`: OpenAI HTTP/WebSocket integration, shared session config, assistant prompt, sideband control, and session orchestration.
- `src/observability/`: structured logger and event journal support.

`mcp-client.ts` is a compatibility facade. New adapter implementation belongs in the focused adapter files, not in the facade.

## Security boundaries

- CRUD pages use the Supabase anon key and database RLS.
- `/api/voice/tool-call` validates the Supabase session before using the shared service-role-backed methods.
- `/api/mcp` is server-to-server. Production refuses to serve it without `MCP_AUTH_TOKEN` and validates the bearer value when configured.
- The gateway returns short-lived Realtime tokens but never the OpenAI API key.
- Gateway CORS accepts only configured origins (plus requests without an Origin header, such as server-to-server and tests).
- Session-creation rate limits apply to `/api/realtime/token` and the legacy `/api/realtime/session`, not globally to health/debug routes.

## Persistence warning

`createVisitWithItems` performs several Supabase writes from application code. They are not wrapped in a database transaction, so a failure can leave a visit without all items/reminders. Prefer a Postgres function/RPC when making this workflow transactional.
