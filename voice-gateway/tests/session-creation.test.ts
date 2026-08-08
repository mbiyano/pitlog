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

describe('CORS policy', () => {
  it('allows configured browser origins', async () => {
    const { app } = await buildTestApp();
    const origin = config.CORS_ALLOWED_ORIGINS[0]!;
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin },
    });

    expect(res.headers['access-control-allow-origin']).toBe(origin);
    await app.close();
  });

  it('does not grant CORS access to unknown origins', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin: 'https://not-allowed.example' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });
});

describe('POST /api/realtime/session', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const { fetch: mockFetch } = await import('undici');
    vi.clearAllMocks();
    vi.mocked(mockFetch)
      // First call: createRealtimeSession
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          value: 'ek_testtoken',
          expires_at: 1_800_000_000,
          session: { id: 'sess_test123' },
        }),
        text: async () => '',
        headers: { get: () => null },
      } as unknown as Awaited<ReturnType<typeof mockFetch>>)
      // Second call: relaySdpOffer
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'v=0\r\no=- 1234 2 IN IP4 127.0.0.1\r\n',
        json: async () => ({}),
        headers: { get: (h: string) => (h === 'location' ? '/v1/realtime/calls/rtc_testcall123' : null) },
      } as unknown as Awaited<ReturnType<typeof mockFetch>>);

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

    const { fetch: mockFetch } = await import('undici');
    const [clientSecretsCall, callsCall] = vi.mocked(mockFetch).mock.calls;
    expect(clientSecretsCall?.[0]).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect(callsCall?.[0]).toBe('https://api.openai.com/v1/realtime/calls');

    const clientSecretRequest = clientSecretsCall?.[1] as { body?: string };
    const requestBody = JSON.parse(clientSecretRequest.body ?? '{}') as {
      session?: Record<string, unknown>;
    };
    expect(requestBody.session).toMatchObject({
      type: 'realtime',
      model: 'gpt-realtime-2.1',
      output_modalities: ['audio'],
      audio: {
        input: {
          transcription: {
            model: 'gpt-4o-mini-transcribe',
            language: 'es',
          },
        },
      },
    });
    expect(requestBody.session).not.toHaveProperty('modalities');
    expect(requestBody.session).not.toHaveProperty('temperature');
  });

  it('returns a current Realtime client secret for browser-direct signaling', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/realtime/token',
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      token: 'ek_testtoken',
      model: 'gpt-realtime-2.1',
    });

    const { fetch: mockFetch } = await import('undici');
    expect(vi.mocked(mockFetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mockFetch).mock.calls[0]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/client_secrets',
    );
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
