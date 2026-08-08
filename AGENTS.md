# PitLog agent guide

These instructions apply to the whole repository.

## Start here

Read the following before changing code:

1. `.claude/context/PRODUCT.md`
2. `.claude/context/ARCHITECTURE.md`
3. `.claude/context/ENGINEERING.md`

Use the code as the final authority. Keep those context files synchronized whenever a change affects a flow, boundary, invariant, command, environment variable, or known limitation.

## Repository boundaries

- `browser-app/` owns the Next.js UI, Supabase-backed CRUD, authenticated browser tool endpoint, and the server-to-server MCP endpoint.
- `voice-gateway/` owns OpenAI Realtime session creation, optional sideband control, MCP adapters, confirmation policy, and gateway HTTP security.
- `browser-app/supabase/migrations/` is the source of truth for the database schema and RLS policies.
- Route files should be thin transport adapters. Put reusable behavior in `features/`, `lib/`, or a backend domain module.
- Preserve the feature-oriented `browser-app/src/features/voice/` boundary. UI components must not gain server-only imports.
- Preserve backend dependency direction: API routes → session/application services → Realtime/MCP/domain modules.

## Non-negotiable behavior

- User-facing UI and spoken assistant text use natural Rioplatense Spanish. Code identifiers and technical comments use English.
- Never expose or log `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MCP_AUTH_TOKEN`, gateway bearer tokens, ephemeral Realtime tokens, or raw SDP.
- A voice-initiated write requires explicit spoken confirmation. The browser-direct path enforces this in `features/voice/lib/confirmation.ts`; the sideband path enforces it in `ConfirmationManager`. Keep both paths behaviorally aligned.
- A vehicle must have an existing customer. Never silently create an unassigned placeholder customer.
- Browser tool calls require an authenticated Supabase user. Server-to-server MCP calls require `MCP_AUTH_TOKEN` in production.
- Gateway CORS must use `CORS_ALLOWED_ORIGINS`; do not replace it with a permissive wildcard.
- Validate data at trust boundaries. Prefer Zod for new request/tool payloads and environment configuration.
- Do not hand-edit generated build output (`.next/`, `dist/`) or local logs.

## Verification

From the repository root:

```bash
pnpm check
pnpm build
```

During focused work, use `pnpm check:app`, `pnpm check:gateway`, or the service-local scripts. Backend behavior changes need Vitest coverage. Frontend currently has lint and typecheck but no test runner; isolate pure behavior so tests can be added without rendering whole pages.

Do not claim completion if an applicable check is failing. If a build is blocked by environment or credentials, report the exact boundary and still run every offline check available.
