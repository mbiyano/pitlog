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
4. The gateway creates an OpenAI Realtime client secret through `/v1/realtime/client_secrets`, using the shared config in `realtime-session-config.ts`, stores local session state, and returns the ephemeral value plus model name.
5. The browser sends its SDP directly to OpenAI through `/v1/realtime/calls` with that ephemeral secret. Audio and Realtime data events then flow directly between browser and OpenAI.
6. The browser receives tool-call events and executes reads or writes immediately when the model has clear intent and valid required fields.
7. The browser posts the tool to the same-origin authenticated `/api/voice/tool-call` route.
8. That route invokes `features/voice/server/mcp-methods.ts` directly. Writes are read back from Supabase and only return `persistenciaVerificada: true` after the row is found; the browser rejects any unverified write result before returning it to the model.

Connection attempts are generation-scoped and abortable. Cancelling invalidates the active generation, aborts token and SDP requests, closes WebRTC/media resources, and produces no error state. Unexpected browser, gateway, or provider failures are mapped to curated user messages; raw exception text is never included in alerts or the visible diagnostic journal.

`POST /api/realtime/session` remains as a legacy gateway-relayed SDP flow. The sideband controller is used by that path and applies the same immediate execution, validation, and persistence-verification policy. Do not assume the sideband is active in the browser-direct token flow.

The default voice model is `gpt-realtime-2.1`. The shared session config uses the current nested `audio` contract, Spanish transcription context for names and Argentine plates, and audio output transcripts from `response.output_audio_transcript.done`.

Plate lookup normalizes legacy and Mercosur formats and queries exact canonical/compact candidates. Database lookup errors are failures, not “not found” results; this prevents a read outage from triggering accidental duplicate creation.
The assistant accepts clear plates without a read-back. If characters are ambiguous, it asks one targeted clarification. The browser-direct tool guard tracks lookup misses and requires two misses for the same normalized plate before `crear_auto` can execute; the repeated lookup should happen silently.

## Frontend boundaries

- `src/app/`: routing, layouts, and thin API transports.
- `src/features/voice/`: voice UI, WebRTC hook, client tool safeguards, client tool adapter, and server MCP application service.
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
- `src/conversation/`: session state lifecycle.
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
