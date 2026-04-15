import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import type { Env } from '../config/env.js';
import type { SessionManager } from '../realtime/session-manager.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerRealtimeSessionRoutes } from './routes/realtime-session.js';

export async function buildHttpServer(
  config: Env,
  sessionManager: SessionManager,
): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
            },
          }
        : {}),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-gateway-token"]',
          '*.sdp',
          '*.ephemeralToken',
          '*.client_secret',
        ],
        censor: '[REDACTED]',
      },
    },
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // ── Plugins ────────────────────────────────────────────────────────────────

  await fastify.register(sensible);

  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Session-Id'],
  });

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_SESSION_PER_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      if (req.routeOptions?.url === '/api/realtime/session' && req.method === 'POST') {
        return (
          (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
          req.ip
        );
      }
      return '';
    },
  });

  // ── Content-Type parser for SDP ────────────────────────────────────────────

  fastify.addContentTypeParser(
    'application/sdp',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  // ── Optional bearer auth ───────────────────────────────────────────────────

  if (config.GATEWAY_BEARER_TOKEN) {
    const token = config.GATEWAY_BEARER_TOKEN;
    fastify.addHook('onRequest', async (req, reply) => {
      if (req.url === '/healthz') return;
      const auth = req.headers.authorization ?? '';
      if (!auth.startsWith('Bearer ') || auth.slice(7) !== token) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    });
  }

  // ── Routes ─────────────────────────────────────────────────────────────────

  registerHealthRoutes(fastify, sessionManager);
  registerRealtimeSessionRoutes(fastify, sessionManager);

  // ── 404 handler ────────────────────────────────────────────────────────────

  fastify.setNotFoundHandler(async (_req, reply) => {
    return reply.status(404).send({ error: 'Not found' });
  });

  // ── Error handler ──────────────────────────────────────────────────────────

  fastify.setErrorHandler(async (err: Error & { statusCode?: number }, req, reply) => {
    const status = err.statusCode ?? 500;
    req.log.error({ err: err.message, status }, 'Unhandled error');
    return reply.status(status).send({
      error: status >= 500 ? 'Internal server error' : err.message,
    });
  });

  return fastify;
}


export async function startServer(
  config: Env,
  sessionManager: SessionManager,
): Promise<FastifyInstance> {
  const server = await buildHttpServer(config, sessionManager);

  await server.listen({ port: config.PORT, host: '0.0.0.0' });
  server.log.info(`voice-gateway listening on port ${config.PORT}`);

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, 'Shutdown signal received');
    sessionManager.destroy();
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return server;
}
