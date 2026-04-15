# browser-app — Taller Mecánico

Sistema de gestión para taller mecánico. Next.js + Supabase + asistente de voz.

## Requisitos

- Node.js 20+
- pnpm
- Cuenta en [Supabase](https://supabase.com) (hosted)

## Setup rápido

### 1. Instalar dependencias

```bash
cd browser-app
pnpm install
```

### 2. Configurar Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar los archivos en orden:
   - `supabase/migrations/00001_initial_schema.sql`
   - `supabase/migrations/00002_rls_policies.sql`
3. Copiar la URL del proyecto y las keys desde **Settings > API**

### 3. Variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_VOICE_GATEWAY_URL=http://localhost:8080
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Seed data (opcional)

```bash
pnpm db:seed
```

Carga 5 clientes, 7 vehículos, 5 visitas con ítems de servicio, recordatorios y notas.

### 5. Crear usuario

Ir a **Supabase Dashboard > Authentication > Users** y crear un usuario con email/password. O registrarse desde la app en `/login`.

### 6. Iniciar la app

```bash
pnpm dev
```

La app corre en `http://localhost:3000`.

## Pantallas

| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Panel con KPIs, búsqueda rápida, recordatorios y últimos servicios |
| `/clientes` | Lista, búsqueda, crear y editar clientes |
| `/clientes/[id]` | Detalle de cliente con vehículos vinculados |
| `/vehiculos` | Lista de vehículos con búsqueda por patente/marca/modelo |
| `/vehiculos/[id]` | Detalle, historial de servicios (timeline), recordatorios |
| `/vehiculos/nuevo` | Crear vehículo asignándolo a un cliente |
| `/servicio/nuevo` | Registrar servicio: buscar vehículo por patente, capturar km, agregar ítems |
| `/recordatorios` | Gestionar recordatorios: filtrar, marcar contactado/hecho/posponer |
| `/voz` | Asistente de voz — conexión WebRTC al Voice Gateway local |

## Integración con Voice Gateway

La página `/voz` se conecta al Voice Gateway (`http://localhost:8080` por defecto).

### Flujo

1. El usuario presiona el botón de llamada
2. El browser pide permiso de micrófono
3. Se crea una `RTCPeerConnection` y un SDP offer
4. El offer se envía por POST a `${VOICE_GATEWAY_URL}/api/realtime/session`
5. El Voice Gateway relay el SDP a OpenAI Realtime, obtiene el answer
6. El browser completa el handshake WebRTC
7. El audio va peer-to-peer entre el browser y OpenAI
8. El Voice Gateway mantiene un sideband WebSocket para tool calls

### Permisos de micrófono en desarrollo local

- Chrome/Edge: `http://localhost:3000` tiene permisos automáticos de micrófono
- Firefox: puede requerir aceptar manualmente
- Safari: requiere HTTPS en producción, pero `localhost` funciona en desarrollo

### Cambiar de gateway local a remoto

Editar `NEXT_PUBLIC_VOICE_GATEWAY_URL` en `.env`:

```env
# Local
NEXT_PUBLIC_VOICE_GATEWAY_URL=http://localhost:8080

# Remoto (requiere HTTPS en el gateway)
NEXT_PUBLIC_VOICE_GATEWAY_URL=https://gateway.tu-dominio.com
```

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Auth + DB | Supabase (hosted) |
| Forms | React Hook Form + Zod |
| Dates | date-fns |
| Icons | Lucide React |
| Package manager | pnpm |

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/        # Login/registro
│   ├── (app)/               # Layout con sidebar
│   │   ├── dashboard/       # Panel principal
│   │   ├── clientes/        # CRUD clientes
│   │   ├── vehiculos/       # CRUD vehículos + historial
│   │   ├���─ servicio/nuevo/  # Formulario de nuevo servicio
│   │   ├── recordatorios/   # Gestión de recordatorios
│   │   └── voz/             # Asistente de voz WebRTC
│   ├── layout.tsx           # Root layout
│   └── globals.css
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── layout/              # Sidebar, page header
│   ├── forms/               # Customer form, vehicle form
│   └── shared/              # Stat card, empty state, loading
├── lib/
│   ├── supabase/            # Client, server, middleware, types
│   ├── services/            # Data layer (customers, vehicles, visits, reminders)
│   ├── validations/         # Zod schemas
│   └── utils/               # cn, formatters
├── middleware.ts             # Auth middleware
supabase/
├── migrations/              # SQL schema + RLS policies
scripts/
└── seed.ts                  # Seed data
```

## Próximos pasos

- [ ] Supabase CLI para manejo de migraciones locales
- [ ] Tests (Vitest + Testing Library)
- [ ] CSV export del historial de vehículos
- [ ] Resumen imprimible por vehículo
- [ ] Upload de fotos/archivos (Supabase Storage)
- [ ] Multi-tenancy real (tabla workshops, scoped RLS)
- [ ] Deploy a Vercel + Supabase production
- [ ] PWA para uso offline en el taller
