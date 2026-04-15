import { z } from 'zod';

const envSchema = z.object({
  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_REALTIME_MODEL: z
    .string()
    .default('gpt-4o-realtime-preview-2024-12-17'),
  OPENAI_REALTIME_VOICE: z
    .enum(['alloy', 'echo', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse'])
    .default('shimmer'),

  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // CORS
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean)),

  // Auth
  GATEWAY_BEARER_TOKEN: z.string().optional(),

  // MCP
  USE_MOCK_MCP: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  MCP_SERVER_BASE_URL: z.string().url().optional(),
  MCP_AUTH_TOKEN: z.string().optional(),

  // Sessions
  SESSION_TTL_MS: z.coerce.number().int().min(60_000).default(1_800_000),
  RATE_LIMIT_SESSION_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  MAX_TOOL_CALLS_PER_TURN: z.coerce.number().int().min(1).default(5),
  JOURNAL_MAX_EVENTS: z.coerce.number().int().min(10).default(200),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}

export const config: Env = parseEnv();
