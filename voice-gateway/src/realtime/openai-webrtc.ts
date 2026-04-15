import { fetch } from 'undici';
import type { Logger } from '../observability/logger.js';
import { TOOL_DEFINITIONS } from '../mcp/mcp-tool-registry.js';

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
 * Step 1 — Create a server-side Realtime session.
 * Returns a session ID and a short-lived ephemeral token (ek_...) for signaling.
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

  const res = await fetch(`${OPENAI_BASE}/v1/realtime/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      modalities: ['audio', 'text'],
      instructions,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.65,
        prefix_padding_ms: 500,
        silence_duration_ms: 1200,
        create_response: true,
      },
      temperature: 0.8,
      max_response_output_tokens: 'inf',
    }),
  });

  const elapsed = Date.now() - start;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error({ status: res.status, elapsed }, 'Failed to create Realtime session');
    throw new Error(`OpenAI session creation failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    id: string;
    client_secret?: { value: string };
  };

  if (!data.id) {
    throw new Error('OpenAI session response missing id');
  }
  if (!data.client_secret?.value) {
    throw new Error('OpenAI session response missing client_secret.value');
  }

  log.info({ realtimeSessionId: data.id, elapsed }, 'Realtime session created');

  return {
    realtimeSessionId: data.id,
    ephemeralToken: data.client_secret.value,
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
  model: string;
  log: Logger;
}): Promise<RelaySdpResult> {
  const { sdpOffer, ephemeralToken, model, log } = opts;
  const start = Date.now();

  const url = `${OPENAI_BASE}/v1/realtime?model=${encodeURIComponent(model)}`;

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
