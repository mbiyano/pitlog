import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildHttpServer } from '../src/api/http-server.js';
import { SessionManager } from '../src/realtime/session-manager.js';
import { InMemoryConversationStateStore } from '../src/conversation/conversation-state-store.js';
import { MockMcpAdapter } from '../src/mcp/mcp-client.js';
import { config } from '../src/config/env.js';
import type { Logger } from '../src/observability/logger.js';
import type { FastifyInstance } from 'fastify';

// Mock OpenAI HTTP calls
vi.mock('undici', () => ({
  fetch: vi.fn(),
}));

// Mock WebSocket (sideband)
vi.mock('ws', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
    })),
    OPEN: 1,
  };
});

const noopLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

async function buildTestApp(): Promise<{ app: FastifyInstance; sessionManager: SessionManager }> {
  const stateStore = new InMemoryConversationStateStore(30_000);
  const mcpAdapter = new MockMcpAdapter();
  const sessionManager = new SessionManager(config, mcpAdapter, stateStore, noopLog);
  const app = await buildHttpServer(config, sessionManager);
  return { app, sessionManager };
}

describe('GET /healthz', () => {
  it('returns 200 with status ok', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string }>();
    expect(body.status).toBe('ok');
    await app.close();
  });

  it('includes activeSessions count', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    const body = res.json<{ activeSessions: number }>();
    expect(typeof body.activeSessions).toBe('number');
    await app.close();
  });
});

describe('POST /api/realtime/session', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const { fetch: mockFetch } = await import('undici');
    vi.mocked(mockFetch)
      // First call: createRealtimeSession
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'sess_test123',
          client_secret: { value: 'ek_testtoken' },
        }),
        text: async () => '',
        headers: { get: () => null },
      } as unknown as Response)
      // Second call: relaySdpOffer
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'v=0\r\no=- 1234 2 IN IP4 127.0.0.1\r\n',
        json: async () => ({}),
        headers: { get: (h: string) => (h === 'location' ? '/v1/realtime/calls/rtc_testcall123' : null) },
      } as unknown as Response);

    ({ app } = await buildTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 400 for non-SDP body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/realtime/session',
      headers: { 'Content-Type': 'application/sdp' },
      body: 'not an sdp',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 201 with SDP answer for valid SDP offer', async () => {
    const validSdp = 'v=0\r\no=- 1234 2 IN IP4 127.0.0.1\r\ns=-\r\n';
    const res = await app.inject({
      method: 'POST',
      url: '/api/realtime/session',
      headers: { 'Content-Type': 'application/sdp' },
      body: validSdp,
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers['content-type']).toContain('application/sdp');
    expect(res.headers['x-session-id']).toBeTruthy();
  });
});

describe('GET /api/realtime/session/:sessionId', () => {
  it('returns 404 for unknown session', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/realtime/session/nonexistent-id',
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/unknown' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
