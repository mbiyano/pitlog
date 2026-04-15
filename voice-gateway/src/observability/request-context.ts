import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export interface RequestContext {
  requestId: string;
  sessionId?: string;
  callId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function updateContext(patch: Partial<RequestContext>): void {
  const ctx = storage.getStore();
  if (ctx) {
    Object.assign(ctx, patch);
  }
}

export function requestContextPlugin(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();
    const ctx: RequestContext = { requestId };
    // Attach to request so downstream can access without AsyncLocalStorage
    (request as FastifyRequest & { ctx: RequestContext }).ctx = ctx;
    // Run remainder of request lifecycle in this context
    storage.run(ctx, () => {});
    request.log = request.log.child({ requestId });
  });
}
