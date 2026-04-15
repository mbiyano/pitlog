import type { FastifyInstance } from 'fastify';
import type { SessionManager } from '../../realtime/session-manager.js';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = { version: '0.1.0' };

export function registerHealthRoutes(
  fastify: FastifyInstance,
  sessionManager: SessionManager,
): void {
  fastify.get('/healthz', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: pkg.version,
      uptime: Math.floor(process.uptime()),
      activeSessions: sessionManager.activeCount(),
      timestamp: new Date().toISOString(),
    });
  });
}
