import { fetch } from 'undici';
import type { Logger } from '../observability/logger.js';
import { buildRealtimeSessionConfig } from './realtime-session-config.js';

const OPENAI_BASE = 'https://api.openai.com';

export interface CreateSessionResult {
  realtimeSessionId: string;
  ephemeralToken: string;
}

export interface RelaySdpResult {
  sdpAnswer: string;
  callId: string;
}

/**
 * Step 1 — Create a short-lived Realtime client secret.
 * OpenAI creates the associated session and returns its ID with the secret.
 *
 * Includes full session config (instructions, tools, turn_detection) so the
 * model has everything it needs from the moment WebRTC audio begins — before
 * the sideband WebSocket connects.
 */
export async function createRealtimeSession(opts: {
  apiKey: string;
  model: string;
  voice: string;
  instructions: string;
  log: Logger;
}): Promise<CreateSessionResult> {
  const { apiKey, model, voice, instructions, log } = opts;
  const start = Date.now();

  const res = await fetch(`${OPENAI_BASE}/v1/realtime/client_secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        model,
        ...buildRealtimeSessionConfig(voice, instructions),
      },
    }),
  });

  const elapsed = Date.now() - start;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error({ status: res.status, elapsed }, 'Failed to create Realtime client secret');
    throw new Error(`OpenAI client secret creation failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    value?: string;
    session?: { id?: string };
  };

  if (!data.session?.id) {
    throw new Error('OpenAI client secret response missing session.id');
  }
  if (!data.value) {
    throw new Error('OpenAI client secret response missing value');
  }

  log.info({ realtimeSessionId: data.session.id, elapsed }, 'Realtime session created');

  return {
    realtimeSessionId: data.session.id,
    ephemeralToken: data.value,
  };
}

/**
 * Step 2 — Relay the browser's SDP offer to OpenAI and get the SDP answer.
 * Uses the ephemeral token from step 1. Extracts the call_id from the
 * Location response header for sideband attachment.
 */
export async function relaySdpOffer(opts: {
  sdpOffer: string;
  ephemeralToken: string;
  log: Logger;
}): Promise<RelaySdpResult> {
  const { sdpOffer, ephemeralToken, log } = opts;
  const start = Date.now();

  const url = `${OPENAI_BASE}/v1/realtime/calls`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ephemeralToken}`,
      'Content-Type': 'application/sdp',
    },
    body: sdpOffer,
  });

  const elapsed = Date.now() - start;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error({ status: res.status, elapsed }, 'Failed to relay SDP offer');
    throw new Error(`OpenAI SDP relay failed (${res.status}): ${body}`);
  }

  const sdpAnswer = await res.text();
  if (!sdpAnswer || !sdpAnswer.startsWith('v=')) {
    throw new Error('OpenAI returned an invalid SDP answer');
  }

  // Extract call_id — check both Location header and response headers
  const location = res.headers.get('location') ?? '';
  let callId = location.split('/').pop() ?? '';

  // Some API versions return call_id in a dedicated header
  if (!callId || !callId.startsWith('rtc_')) {
    const headerCallId = res.headers.get('x-call-id') ?? '';
    if (headerCallId) {
      callId = headerCallId;
    }
  }

  if (!callId || !callId.startsWith('rtc_')) {
    log.error(
      { location, allHeaders: Object.fromEntries(res.headers.entries()), elapsed },
      'Could not extract call_id — sideband will open a separate session (tools may not work)',
    );
  } else {
    log.info({ callId, elapsed }, 'SDP relay complete, call_id captured');
  }

  return { sdpAnswer, callId };
}
