# voice-gateway

Local-first orchestration gateway for a car workshop voice assistant. Runs during the MVP phase at `http://localhost:8080`.

---

## Why does this service exist?

The browser cannot safely hold an OpenAI API key. This gateway sits between the browser and OpenAI, so:

- **Secrets stay server-side** — `OPENAI_API_KEY` never reaches the browser.
- **Tool calls are controlled** — the model can only call the 12 approved workshop tools.
- **Write operations require confirmation** — creating or updating workshop data requires an explicit spoken confirmation in Spanish.
- **Session state is centralised** — vehicle context, customer context, and pending actions are tracked per session.
- **Sideband gives full control** — the server has a parallel WebSocket to the same Realtime session, independent of the audio stream.

---

## Architecture

```
Browser (localhost:3000)
  │
  │  1. POST /api/realtime/session  (raw SDP offer)
  ▼
voice-gateway (localhost:8080)
  │
  ├─ 2. POST /v1/realtime/sessions  ──────────────────────► OpenAI
  │      ◄── { id: sess_..., client_secret: { value: ek_... } }
  │
  ├─ 3. POST /v1/realtime?model=...  (SDP offer, Bearer: ek_...)
  │      ◄── SDP answer  +  Location: /v1/realtime/calls/rtc_...
  │
  ├─ 4. WSS /v1/realtime?call_id=rtc_...  (sideband, Bearer: sk_...)
  │         │
  │         ├─ SEND  session.update  (instructions + tools + voice)
  │         ├─ RECV  response.function_call_arguments.done  ──► MCP
  │         └─ RECV  transcription  ──► confirm/cancel detection
  │
  └─ 5. SDP answer  ──► Browser
              │
              └── Browser ◄──────────────────────────────► OpenAI
                         (direct WebRTC audio, peer-to-peer)
```

### WebRTC + sideband explained

- The browser creates a WebRTC peer connection for audio. The audio goes **directly** between the browser and OpenAI — not through this gateway. This keeps latency low.
- The SDP offer/answer handshake goes through the gateway so the gateway can capture the `call_id` (from OpenAI's `Location` response header).
- Using that `call_id`, the gateway opens a **sideband WebSocket** to the same OpenAI Realtime session. This is the server's control channel — it listens for tool calls, injects tool results, and can send instructions at any time.

---

## Local setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- An OpenAI account with Realtime API access

### Run locally

```bash
cd voice-gateway

# 1. Install dependencies
pnpm install

# 2. Configure
cp .env.example .env
# Edit .env and set OPENAI_API_KEY

# 3. Start (hot-reload)
pnpm dev
```

The server starts at `http://localhost:8080`.

```bash
# Verify
curl http://localhost:8080/healthz
```

### Run tests

```bash
pnpm test
pnpm test:coverage
```

### Build for production

```bash
pnpm build        # TypeScript compile → dist/
node dist/index.js
```

### Docker

```bash
# Build image
docker build -t voice-gateway .

# Run
docker run -p 8080:8080 \
  -e OPENAI_API_KEY=sk-your-key \
  -e USE_MOCK_MCP=true \
  voice-gateway

# Or with docker-compose (reads .env automatically)
docker compose up
```

---

## HTTP API

### `GET /healthz`

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 42,
  "activeSessions": 1,
  "timestamp": "2024-11-15T10:00:00.000Z"
}
```

### `POST /api/realtime/session`

```
Content-Type: application/sdp
[raw SDP offer body]
```

Response:
```
HTTP/1.1 201 Created
Content-Type: application/sdp
X-Session-Id: <uuid>

[raw SDP answer]
```

The browser uses the SDP answer to complete its WebRTC `setRemoteDescription()`.

### `GET /api/realtime/session/:sessionId`

Returns sanitized session state (no secrets, no raw MCP data).

### `POST /api/realtime/session/:sessionId/end`

Ends the session and disconnects the sideband WebSocket.

### `GET /api/realtime/session/:sessionId/events`

Returns the last N events from the in-memory journal. Useful for debugging.

Query params: `?limit=50` (default 50, max 200).

---

## Environment variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | Your OpenAI API key |
| `OPENAI_REALTIME_MODEL` | No | `gpt-4o-realtime-preview-2024-12-17` | Realtime model |
| `OPENAI_REALTIME_VOICE` | No | `shimmer` | Assistant voice |
| `PORT` | No | `8080` | HTTP port |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `GATEWAY_BEARER_TOKEN` | No | — | If set, browser must send `Authorization: Bearer <token>` |
| `USE_MOCK_MCP` | No | `true` | `true` = in-memory mock data, `false` = real MCP server |
| `MCP_SERVER_BASE_URL` | When `USE_MOCK_MCP=false` | — | Real MCP server base URL |
| `MCP_AUTH_TOKEN` | No | — | Bearer token for MCP server |
| `SESSION_TTL_MS` | No | `1800000` | Session auto-expire (ms) |

---

## Switching from mock MCP to real MCP

```bash
# In .env:
USE_MOCK_MCP=false
MCP_SERVER_BASE_URL=http://your-mcp-server:4000
MCP_AUTH_TOKEN=your-mcp-auth-token
```

The `HttpMcpAdapter` sends JSON-RPC 2.0 POST requests to `{MCP_SERVER_BASE_URL}/mcp`. Your MCP server must expose that endpoint and accept:

```json
{
  "jsonrpc": "2.0",
  "method": "buscar_auto_por_patente",
  "params": { "patente": "ABC123" },
  "id": 1234567890
}
```

---

## Connecting from a local Next.js app

```typescript
// In your Next.js app (browser)

async function startVoiceSession(): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();

  // Add microphone track
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // Add data channel (OpenAI uses this for events)
  pc.createDataChannel('oai-events');

  // Create SDP offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait for ICE gathering
  await new Promise<void>(resolve => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') resolve();
    };
  });

  // Send to gateway
  const response = await fetch('http://localhost:8080/api/realtime/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription?.sdp,
  });

  if (!response.ok) throw new Error('Session creation failed');

  const sessionId = response.headers.get('x-session-id');
  const sdpAnswer = await response.text();

  // Complete WebRTC handshake
  await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer });

  console.log('Voice session ready, sessionId:', sessionId);
  return pc;
}
```

---

## Confirmation flow

Write operations (creating vehicles, customers, visits, service records, reminders) always require an explicit spoken confirmation:

```
Mechanic: "registrá una visita para ABC 123"
Assistant: "Voy a registrar una visita para el auto ABC 123 Ford Falcon
            del 15 de noviembre. ¿Lo guardamos?"
Mechanic: "sí, guardalo"          ← gateway detects confirmation
Assistant: "Listo, visita registrada."
```

Accepted confirmations (Rioplatense Spanish):
`sí guardalo`, `confirmo`, `dale`, `listo`, `exacto`, `correcto`, `adelante`, `guardalo`, `guardá`

Accepted cancellations:
`cancelá`, `no lo guardes`, `dejalo`, `no`, `espera`, `olvidalo`

Confirmations expire after **60 seconds** of inactivity.

---

## Workshop tools

| Tool | Type | Description |
|------|------|-------------|
| `buscar_auto_por_patente` | Read | Search vehicle by plate |
| `crear_auto` | **Write** | Register new vehicle |
| `buscar_cliente` | Read | Search customer |
| `crear_cliente` | **Write** | Register new customer |
| `crear_visita_taller` | **Write** | Create workshop visit |
| `agregar_trabajo_a_visita` | **Write** | Add service item to visit |
| `actualizar_trabajo` | **Write** | Update service record |
| `obtener_historial_auto` | Read | Get vehicle service history |
| `obtener_ultimo_service` | Read | Get last service details |
| `crear_recordatorio_service` | **Write** | Create service reminder |
| `listar_recordatorios_pendientes` | Read | List pending reminders |
| `redactar_mensaje_cliente` | Read | Draft customer message |

---

## Deploying remotely (future)

To deploy this gateway to a remote server:

1. **Change nothing in the code** — all URLs and connection logic already work remotely.
2. Update `CORS_ALLOWED_ORIGINS` to your production browser app's origin.
3. Set `GATEWAY_BEARER_TOKEN` to secure the endpoint.
4. Build the Docker image and push to a registry.
5. Deploy on any Docker host (Railway, Fly.io, EC2, etc.).
6. Update the browser app's gateway URL from `http://localhost:8080` to your deployed URL.

The sideband WebSocket connects to OpenAI directly from wherever the gateway runs — no tunnels or special networking required.

---

## Project structure

```
src/
├── config/
│   └── env.ts                    # Zod-validated env config
├── observability/
│   ├── logger.ts                 # pino logger with redaction
│   └── request-context.ts       # AsyncLocalStorage for request IDs
├── conversation/
│   ├── conversation-state-store.ts  # Per-session state (vehicle, customer, visit, pending)
│   └── confirmation-manager.ts     # Confirmation flow + utterance detection
├── mcp/
│   ├── mcp-client.ts            # McpAdapter interface + Http + Mock implementations
│   └── mcp-tool-registry.ts     # Zod schemas, tool definitions, dispatcher
├── policies/
│   └── guardrails.ts            # Allowed tools, validation, per-turn rate limiting
├── realtime/
│   ├── openai-webrtc.ts         # createRealtimeSession + relaySdpOffer
│   ├── realtime-event-journal.ts   # Circular event buffer per session
│   ├── sideband-controller.ts   # WebSocket sideband + event handling
│   └── session-manager.ts       # Session lifecycle orchestration
├── api/
│   ├── http-server.ts           # Fastify setup, plugins, graceful shutdown
│   └── routes/
│       ├── health.ts            # GET /healthz
│       └── realtime-session.ts  # Session CRUD + events endpoint
└── index.ts                     # Entry point
```
