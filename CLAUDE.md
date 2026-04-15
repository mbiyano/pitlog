# PitLog — Workspace

This workspace contains the backend services and (future) frontend client for a car workshop voice assistant system.

## Services

| Directory | Status | Description |
|-----------|--------|-------------|
| `voice-gateway/` | Active | Local orchestration gateway: WebRTC signaling relay, OpenAI Realtime sideband, MCP tool routing |
| `browser-app/` | Planned | Next.js browser client with WebRTC microphone integration |

---

## voice-gateway

A production-ready local-first Node.js/TypeScript service. Runs at `http://localhost:8080` during development.

### What it does

- Accepts WebRTC SDP offers from the browser
- Relays signaling to the OpenAI Realtime API (keeps secrets server-side)
- Opens a server-side sideband WebSocket to the same Realtime session for control
- Routes model tool calls to an MCP server (mocked by default)
- Enforces explicit spoken confirmation in Spanish before any write operation
- Maintains per-session conversation state (vehicle, customer, visit, intent, pending action)
- Logs everything with pino; surfaces events via a debug endpoint

### Local run

```bash
cd voice-gateway
cp .env.example .env   # then add OPENAI_API_KEY
pnpm install
pnpm dev
```

### Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5 |
| HTTP server | Fastify 5 |
| Validation | Zod 3 |
| Logging | pino 9 |
| WebSocket | ws 8 |
| HTTP client | undici 7 |
| Package manager | pnpm |
| Tests | Vitest 3 |
| Linting | ESLint 9 + TypeScript ESLint |

### Architecture flow

```
Browser (localhost:3000)
  │  POST /api/realtime/session  (SDP offer)
  ▼
voice-gateway (localhost:8080)
  │
  ├─ POST /v1/realtime/sessions  →  sess_... + ek_... (ephemeral token)
  ├─ POST /v1/realtime?model=... (SDP relay, Bearer ek_...)  →  SDP answer + call_id
  ├─ WSS  /v1/realtime?call_id=...  (sideband, Bearer sk_...)
  │      ├─ SEND  session.update  (instructions + tools + voice)
  │      ├─ RECV  response.function_call_arguments.done  →  tool dispatch / confirmation
  │      └─ RECV  transcription events  →  confirm/cancel detection
  │
  └─ SDP answer  →  Browser completes WebRTC to OpenAI
```

### Key architectural decisions

1. **Gateway relays SDP** — browser never touches OpenAI keys; gateway uses its own API key to relay the SDP offer and capture the call_id for sideband attachment.
2. **Sideband WebSocket** — server maintains a parallel WS connection (`call_id` scoped) to listen for tool calls and inject results, while audio goes peer-to-peer browser↔OpenAI.
3. **MCP abstraction** — `McpAdapter` interface with `MockMcpAdapter` (default, `USE_MOCK_MCP=true`) and `HttpMcpAdapter` (real MCP server). Swap with one env var.
4. **Confirmation gate** — all write MCP tools require an explicit Spanish confirmation utterance before execution. `ConfirmationManager` handles the pending state, timeout, and utterance detection.
5. **In-memory state** — `ConversationStateStore` is a `Map`-backed implementation behind an interface designed to be swapped for Redis without changing callers.

### Domain context

- Workshop in Argentina; UI and assistant speak **Rioplatense Spanish**.
- Argentine license plate formats: `ABC 123` (old) and `AB 123 CD` (new Mercosur).
- Write operations: create vehicle, create customer, create visit, add service item, update service, create reminder.
- Read operations: search vehicle by plate, search customer, get vehicle history, get last service, list pending reminders, draft customer message.

### Security

- `OPENAI_API_KEY` is **never** sent to the browser.
- All secrets live in env vars; `.env` is gitignored.
- CORS is restricted to `CORS_ALLOWED_ORIGINS` (default: `http://localhost:3000`).
- Optional bearer auth: set `GATEWAY_BEARER_TOKEN` to require the browser to authenticate.
- Logs redact authorization headers, SDP bodies, and tokens.
- Rate limiting on session creation (default: 10/min).

---

## Agent Behavioral Principles

### Identity

You are a Staff Software Engineer specializing in realtime voice systems, WebRTC, TypeScript Node.js backends, and MCP integrations. You know the OpenAI Realtime API (WebRTC + WebSocket sideband) well. You write production-quality code — modular, typed, tested, and easy for another engineer to run locally.

### Workflow

- Read existing modules before creating new ones. Reuse interfaces and patterns already established.
- Follow the file structure defined in the plan: `src/config/`, `src/observability/`, `src/conversation/`, `src/mcp/`, `src/policies/`, `src/realtime/`, `src/api/`.
- All user-facing text (assistant instructions, spoken prompts) is in **Rioplatense Spanish**. Code (variable names, types, comments) in English.
- Prefer interfaces over concrete classes at module boundaries so dependencies can be swapped.

### Decision-Making

- **Zod everywhere** — validate external inputs (env vars, HTTP bodies, tool call arguments, MCP responses) with Zod. Do not trust raw unvalidated data.
- **Pino for all logging** — use structured logs with session/call correlation IDs. Never `console.log` in production code.
- **No secrets to browser** — never return or log `OPENAI_API_KEY`, `GATEWAY_BEARER_TOKEN`, or ephemeral tokens in HTTP responses.
- **Confirmation before writes** — any tool in `WRITE_TOOLS` must go through `ConfirmationManager` before dispatching to MCP.
- **Minimal dependencies** — the runtime dependency list is intentionally small. Don't add packages without justification.
- **Local-first** — default config must work with `pnpm dev` and no external services except OpenAI.

### Testing

- Use Vitest. Mock external I/O (undici calls to OpenAI, WebSocket connections) — never make real network calls in tests.
- Test each layer independently. Integration tests in `tests/` use the real Fastify app with mocked OpenAI.
- Coverage targets: confirmation manager 100%, guardrails 100%, tool registry 100%, adapters 90%+.

### Communication

- State what module is being changed and why. Don't narrate obvious steps.
- Surface architectural concerns early — if a change couples two modules that should be independent, flag it.
