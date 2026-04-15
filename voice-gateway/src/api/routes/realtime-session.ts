import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SessionManager } from '../../realtime/session-manager.js';

export function registerRealtimeSessionRoutes(
  fastify: FastifyInstance,
  sessionManager: SessionManager,
): void {
  /**
   * POST /api/realtime/token
   * Creates an OpenAI Realtime session and returns an ephemeral token.
   * The browser calls this while gathering ICE candidates, then sends the
   * SDP offer directly to OpenAI — saving ~800ms by parallelizing.
   */
  fastify.post('/api/realtime/token', async (req: FastifyRequest, reply: FastifyReply) => {
    req.log.info('Creating ephemeral token');
    const start = Date.now();

    try {
      const result = await sessionManager.createToken();
      const elapsed = Date.now() - start;
      req.log.info({ sessionId: result.sessionId, elapsed }, 'Token created');

      return reply.status(201).send({
        sessionId: result.sessionId,
        token: result.ephemeralToken,
        model: result.model,
      });
    } catch (err) {
      req.log.error({ err: (err as Error).message }, 'Token creation failed');
      return reply.status(502).send({
        error: 'Failed to create Realtime session with OpenAI.',
        detail: (err as Error).message,
      });
    }
  });

  /**
   * POST /api/realtime/session
   * Legacy: Accept an SDP offer from the browser, create a Realtime session,
   * open sideband, and return the SDP answer.
   */
  fastify.post('/api/realtime/session', async (req: FastifyRequest, reply: FastifyReply) => {
    const sdpOffer = req.body as string;

    if (
      typeof sdpOffer !== 'string' ||
      !sdpOffer.trim().startsWith('v=')
    ) {
      return reply.status(400).send({
        error: 'Invalid request body. Expected a raw SDP offer (Content-Type: application/sdp).',
      });
    }

    req.log.info('Creating Realtime session from SDP offer');
    const start = Date.now();

    let sessionId: string;
    let sdpAnswer: string;

    try {
      ({ sessionId, sdpAnswer } = await sessionManager.createSession(sdpOffer));
    } catch (err) {
      req.log.error({ err: (err as Error).message }, 'Session creation failed');
      return reply.status(502).send({
        error: 'Failed to create Realtime session with OpenAI.',
        detail: (err as Error).message,
      });
    }

    const elapsed = Date.now() - start;
    req.log.info({ sessionId, elapsed }, 'Session created, returning SDP answer');

    return reply
      .status(201)
      .header('Content-Type', 'application/sdp')
      .header('X-Session-Id', sessionId)
      .send(sdpAnswer);
  });

  /**
   * GET /api/realtime/session/:sessionId
   * Returns sanitized session state (no secrets).
   */
  fastify.get(
    '/api/realtime/session/:sessionId',
    async (
      req: FastifyRequest<{ Params: { sessionId: string } }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = req.params;
      const state = sessionManager.getSessionState(sessionId);

      if (!state) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Return safe subset — never expose internal IDs or MCP results in full
      return reply.send({
        sessionId: state.sessionId,
        status: state.status,
        createdAt: state.createdAt,
        lastActivityAt: state.lastActivityAt,
        vehicle: state.vehicle,
        customer: state.customer,
        visit: state.visit,
        intent: state.intent,
        missingFields: state.missingFields,
        hasPendingConfirmation: state.pendingConfirmation !== null,
        summary: state.summary,
      });
    },
  );

  /**
   * POST /api/realtime/session/:sessionId/end
   * Terminates a session and disconnects the sideband.
   */
  fastify.post(
    '/api/realtime/session/:sessionId/end',
    async (
      req: FastifyRequest<{ Params: { sessionId: string } }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = req.params;
      const ended = sessionManager.endSession(sessionId);

      if (!ended) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      req.log.info({ sessionId }, 'Session ended by request');
      return reply.send({ status: 'ended', sessionId });
    },
  );

  /**
   * GET /api/realtime/session/:sessionId/events
   * Returns recent journal events for debugging.
   */
  fastify.get(
    '/api/realtime/session/:sessionId/events',
    async (
      req: FastifyRequest<{ Params: { sessionId: string }; Querystring: { limit?: string } }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = req.params;
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 200);

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const events = session.journal.getRecent(limit);
      const summary = session.journal.toSummary();

      return reply.send({ sessionId, summary, events });
    },
  );
}
