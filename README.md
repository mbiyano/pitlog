# PitLog

Sistema de gestión para talleres mecánicos con asistente de voz integrado. Pensado para talleres en Argentina que quieren registrar servicios, vehículos y clientes hablando en español rioplatense.

## Qué hace

Un mecánico abre la app en el browser, presiona el botón de voz y habla:

> "Registrá una visita para la patente AB 123 CD, cambio de aceite y filtro"

El asistente entiende, pide confirmación, y registra el servicio. También puede buscar historial de vehículos, clientes, y crear recordatorios — todo por voz o por la interfaz web.

## Arquitectura

```
┌──────────────────────┐         ┌─────────────────────────┐
│   browser-app        │         │   OpenAI Realtime API   │
│   (Next.js en Vercel)│         │                         │
│                      │◄────────┤  Audio WebRTC directo   │
│   UI + CRUD +        │         │  (peer-to-peer)         │
│   pantalla de voz    │         │                         │
└──────┬───────────────┘         └────────────▲────────────┘
       │                                      │
       │ SDP offer/answer                     │ Sideband WebSocket
       │                                      │ (tool calls + control)
       ▼                                      │
┌──────────────────────┐                      │
│   voice-gateway      │──────────────────────┘
│   (Fastify en Render)│
│                      │───────► MCP Server (mock o real)
│   Relay SDP +        │
│   confirmación de    │───────► Supabase (via MCP)
│   escrituras         │
└──────────────────────┘
```

- **browser-app**: Next.js 15, Supabase (auth + DB), Tailwind, shadcn/ui. Pantallas de clientes, vehículos, servicios, recordatorios y asistente de voz.
- **voice-gateway**: Fastify 5, TypeScript. Relay de señalización WebRTC, sideband WebSocket hacia OpenAI, routing de tool calls via MCP, confirmación obligatoria antes de escrituras.

El audio va directo entre el browser y OpenAI (peer-to-peer). El gateway solo maneja la señalización y los tool calls — nunca toca el audio.

## Estructura del monorepo

```
├── browser-app/          # Frontend Next.js (Vercel)
├── voice-gateway/        # Backend gateway (Render, Docker)
├── render.yaml           # Render Blueprint (voice-gateway)
└── CLAUDE.md             # Instrucciones para agentes AI
```

Cada servicio tiene su propio `README.md` con documentación detallada.

## Quick start

### Requisitos

- Node.js 20+
- pnpm 9+
- Cuenta en OpenAI con acceso a Realtime API
- Cuenta en Supabase

### 1. Voice Gateway

```bash
cd voice-gateway
pnpm install
cp .env.example .env     # agregar OPENAI_API_KEY
pnpm dev                 # http://localhost:8080
```

### 2. Browser App

```bash
cd browser-app
pnpm install
cp .env.example .env     # agregar keys de Supabase
pnpm dev                 # http://localhost:3000
```

## Deploy

| Servicio | Plataforma | Motivo |
|----------|-----------|--------|
| browser-app | Vercel | Deploy nativo de Next.js |
| voice-gateway | Render | Soporte de WebSockets persistentes + Docker |

### Voice Gateway → Render

1. Subir el repo a GitHub
2. En Render → New → Blueprint → conectar el repo (detecta `render.yaml`)
3. Configurar variables secretas en el dashboard: `OPENAI_API_KEY`, `CORS_ALLOWED_ORIGINS`

### Browser App → Vercel

1. En Vercel → New Project → importar el repo
2. Root Directory: `browser-app`
3. Configurar env vars: Supabase keys + `NEXT_PUBLIC_VOICE_GATEWAY_URL` (URL de Render)

## Tech stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| Backend | Fastify 5, TypeScript 5, pino |
| Base de datos | Supabase (PostgreSQL + Auth + RLS) |
| Voz | OpenAI Realtime API (WebRTC + WebSocket sideband) |
| Herramientas | MCP (Model Context Protocol) |
| Validación | Zod |
| Deploy | Vercel + Render (Docker) |

## Dominio

- Talleres mecánicos en Argentina
- Interfaz y asistente en español rioplatense
- Patentes argentinas: `ABC 123` (viejo) y `AB 123 CD` (Mercosur)
- Operaciones de escritura requieren confirmación hablada explícita antes de ejecutarse
