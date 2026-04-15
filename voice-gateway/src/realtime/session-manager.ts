import { randomUUID } from 'node:crypto';
import type { Logger } from '../observability/logger.js';
import type { Env } from '../config/env.js';
import type { McpAdapter } from '../mcp/mcp-client.js';
import type { ConversationStateStore, SessionState } from '../conversation/conversation-state-store.js';
import { createInitialState } from '../conversation/conversation-state-store.js';
import { RealtimeEventJournal } from './realtime-event-journal.js';
import { SidebandController, SYSTEM_INSTRUCTIONS } from './sideband-controller.js';
import { createRealtimeSession, relaySdpOffer } from './openai-webrtc.js';

export interface CreateSessionResult {
  sessionId: string;
  sdpAnswer: string;
}

export interface CreateTokenResult {
  sessionId: string;
  ephemeralToken: string;
  model: string;
}

export interface ActiveSession {
  state: SessionState;
  sideband: SidebandController;
  journal: RealtimeEventJournal;
}

export class SessionManager {
  private readonly sessions = new Map<string, ActiveSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: Env,
    private readonly mcpAdapter: McpAdapter,
    private readonly stateStore: ConversationStateStore,
    private readonly log: Logger,
  ) {
    this.startCleanup();
  }

  /**
   * Lightweight: creates the OpenAI Realtime session and returns an ephemeral
   * token. The browser can call this WHILE gathering ICE candidates, then send
   * the SDP directly to OpenAI with the token.
   */
  async createToken(): Promise<CreateTokenResult> {
    const sessionId = randomUUID();
    const log = this.log.child({ sessionId });
    const start = Date.now();

    log.info('Creating ephemeral token for browser-direct SDP');

    const { realtimeSessionId, ephemeralToken } = await createRealtimeSession({
      apiKey: this.config.OPENAI_API_KEY,
      model: this.config.OPENAI_REALTIME_MODEL,
      voice: this.config.OPENAI_REALTIME_VOICE,
      instructions: SYSTEM_INSTRUCTIONS,
      log,
    });

    // Lightweight state tracking (no sideband)
    const initialState = createInitialState(sessionId, realtimeSessionId, '');
    this.stateStore.set(sessionId, initialState);

    const journal = new RealtimeEventJournal(this.config.JOURNAL_MAX_EVENTS);
    const sideband = new SidebandController({
      callId: '',
      realtimeSessionId,
      sessionId,
      config: this.config,
      mcpAdapter: this.mcpAdapter,
      stateStore: this.stateStore,
      journal,
      log,
    });

    this.sessions.set(sessionId, { state: initialState, sideband, journal });

    const elapsed = Date.now() - start;
    log.info({ realtimeSessionId, elapsed }, 'Ephemeral token created');

    return {
      sessionId,
      ephemeralToken,
      model: this.config.OPENAI_REALTIME_MODEL,
    };
  }

  /** Legacy: creates session + relays SDP through the gateway. */
  async createSession(sdpOffer: string): Promise<CreateSessionResult> {
    const sessionId = randomUUID();
    const log = this.log.child({ sessionId });
    const start = Date.now();

    log.info('Creating new voice session');

    // Step 1: Create OpenAI Realtime session (get ephemeral token)
    // Include full session config so the model has tools + instructions
    // from the moment WebRTC audio begins (before sideband connects).
    const { realtimeSessionId, ephemeralToken } = await createRealtimeSession({
      apiKey: this.config.OPENAI_API_KEY,
      model: this.config.OPENAI_REALTIME_MODEL,
      voice: this.config.OPENAI_REALTIME_VOICE,
      instructions: SYSTEM_INSTRUCTIONS,
      log,
    });

    // Step 2: Relay SDP offer → get SDP answer + call_id
    const { sdpAnswer, callId } = await relaySdpOffer({
      sdpOffer,
      ephemeralToken,
      model: this.config.OPENAI_REALTIME_MODEL,
      log,
    });

    // Step 3: Initialize conversation state
    const initialState = createInitialState(sessionId, realtimeSessionId, callId);
    this.stateStore.set(sessionId, initialState);

    // Step 4: Create and connect sideband WebSocket
    const journal = new RealtimeEventJournal(this.config.JOURNAL_MAX_EVENTS);

    const sideband = new SidebandController({
      callId,
      realtimeSessionId,
      sessionId,
      config: this.config,
      mcpAdapter: this.mcpAdapter,
      stateStore: this.stateStore,
      journal,
      log,
    });

    // Try to connect sideband (optional — tool calls are handled browser-side
    // via the WebRTC data channel). The sideband is a bonus for server-side
    // event logging and future features.
    sideband.connect().catch((err: Error) => {
      log.warn({ err: err.message }, 'Sideband connection failed — tools are handled browser-side via data channel');
    });

    this.sessions.set(sessionId, { state: initialState, sideband, journal });

    const elapsed = Date.now() - start;
    log.info(
      { realtimeSessionId, callId, elapsed },
      'Voice session created',
    );

    return { sessionId, sdpAnswer };
  }

  getSession(sessionId: string): ActiveSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getSessionState(sessionId: string): SessionState | null {
    return this.stateStore.get(sessionId);
  }

  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.log.info({ sessionId }, 'Ending voice session');
    session.sideband.disconnect('session ended by request');
    this.stateStore.update(sessionId, { status: 'ended' });
    this.sessions.delete(sessionId);
    return true;
  }

  listSessions(): SessionState[] {
    return this.stateStore.list();
  }

  getActiveSessions(): ActiveSession[] {
    return Array.from(this.sessions.values());
  }

  activeCount(): number {
    return this.sessions.size;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const ttl = this.config.SESSION_TTL_MS;

      for (const [sessionId, session] of this.sessions) {
        const state = this.stateStore.get(sessionId);
        if (!state || now - state.lastActivityAt > ttl) {
          this.log.info({ sessionId }, 'TTL cleanup: ending stale session');
          this.endSession(sessionId);
        }
      }
    }, 60_000);
    this.cleanupInterval.unref?.();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    for (const sessionId of this.sessions.keys()) {
      this.endSession(sessionId);
    }
  }
}
