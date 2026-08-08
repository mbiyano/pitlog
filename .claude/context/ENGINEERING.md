# Engineering workflow

## Requirements and setup

- Node.js 20 or newer; `.nvmrc` pins the supported baseline.
- pnpm.
- A Supabase project for the browser app.
- An OpenAI API key with Realtime access for real voice sessions.

Each deployable owns its dependencies:

```bash
cd browser-app && pnpm install
cd ../voice-gateway && pnpm install
```

Copy each service's `.env.example` to `.env` and provide local values. Never copy real values into docs, tests, logs, or commits.

## Commands

From the repository root:

```bash
pnpm dev:app          # Next.js on :3000
pnpm dev:gateway      # Fastify on :8080
pnpm check            # lint + typecheck for app; lint + typecheck + tests for gateway
pnpm build            # production builds for both services
pnpm test             # gateway Vitest suite
```

Service-local commands are defined in each `package.json`. The browser build no longer downloads a Google font, so it is safe in offline CI. `next build` may still require valid public Supabase environment variables because routes are compiled.

## Environment ownership

Browser public values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_VOICE_GATEWAY_URL`

Browser server-only values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MCP_AUTH_TOKEN`

Gateway server-only values:

- `OPENAI_API_KEY`
- `GATEWAY_BEARER_TOKEN` when gateway bearer auth is enabled
- `MCP_SERVER_BASE_URL` and `MCP_AUTH_TOKEN` when `USE_MOCK_MCP=false`

`CORS_ALLOWED_ORIGINS` is a comma-separated gateway allowlist. Include the browser deployment origin exactly, including scheme and port where applicable.

## Change recipes

Frontend UX work must follow `browser-app/docs/UX_SYSTEM.md`. Reuse semantic tokens and existing UI/shared primitives before introducing one-off colors or interaction patterns. Update that document when a change establishes or modifies a reusable visual, accessibility, form, navigation, feedback, or responsive rule.

When changing a database record:

1. Add a new numbered migration; do not rewrite an already-applied migration for deployed environments.
2. Update Supabase TypeScript types and the corresponding `lib/services` function.
3. Update validation and UI.
4. Re-check RLS and service-role paths.

When changing a voice tool:

1. Update Zod schema, read/write sets, Realtime tool definition, dispatcher, and confirmation summary in `voice-gateway/src/mcp/`.
2. Update the browser MCP method map if the real adapter persists it there.
3. Keep mock behavior and integration DTOs aligned.
4. Add gateway tests for validation, dispatch, guardrails, and confirmation behavior.
5. If it is a write, add it to the browser `WRITE_TOOLS` set and preserve explicit confirmation.
6. A write adapter must read the persisted row back and return its ID with `persistenciaVerificada: true`; dispatch treats an unverified write result as a failure.

When changing the Realtime prompt or media settings, update the single sources in `workshop-assistant.ts` and `realtime-session-config.ts`; do not duplicate session configuration inside transport functions.

## Known debt

- Frontend has no automated unit/component test runner yet.
- The tool contract is duplicated between gateway definitions and browser persistence handlers; contract drift is possible.
- Browser and sideband confirmation detectors are separate implementations and must be kept aligned.
- The browser-direct token flow and legacy sideband flow coexist. Consolidating on one authoritative tool-execution path would simplify guarantees.
- Service visit + items + reminders creation is not transactional.
- RLS is authenticated-user-wide rather than tenant-scoped.
- Some CRUD pages still contain feature logic directly in route files, especially the new-service form.

Treat this list as prioritization context, not permission to expand an unrelated task.
