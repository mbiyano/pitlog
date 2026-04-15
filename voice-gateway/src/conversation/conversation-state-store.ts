import { randomUUID } from 'node:crypto';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface VehicleContext {
  id: string;
  patente: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  clienteId?: string;
}

export interface CustomerContext {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
}

export interface VisitContext {
  id: string;
  autoId: string;
  fecha: string;
  estado: 'abierta' | 'cerrada';
  kilometraje?: number;
}

export interface PendingConfirmation {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  summaryEs: string;
  realtimeItemId: string;
  callId: string;
  createdAt: number;
  expiresAt: number;
}

export interface SessionState {
  sessionId: string;
  realtimeSessionId: string;
  realtimeCallId: string;
  createdAt: number;
  lastActivityAt: number;
  status: 'active' | 'ended';
  vehicle: VehicleContext | null;
  customer: CustomerContext | null;
  visit: VisitContext | null;
  lastMcpResult: unknown;
  intent: string | null;
  missingFields: string[];
  pendingConfirmation: PendingConfirmation | null;
  summary: string;
  metadata: Record<string, unknown>;
}

export function createInitialState(
  sessionId: string,
  realtimeSessionId: string,
  realtimeCallId: string,
): SessionState {
  const now = Date.now();
  return {
    sessionId,
    realtimeSessionId,
    realtimeCallId,
    createdAt: now,
    lastActivityAt: now,
    status: 'active',
    vehicle: null,
    customer: null,
    visit: null,
    lastMcpResult: null,
    intent: null,
    missingFields: [],
    pendingConfirmation: null,
    summary: '',
    metadata: {},
  };
}

// ── Store interface ───────────────────────────────────────────────────────────

export interface ConversationStateStore {
  get(sessionId: string): SessionState | null;
  set(sessionId: string, state: SessionState): void;
  update(sessionId: string, patch: Partial<SessionState>): SessionState | null;
  delete(sessionId: string): boolean;
  list(): SessionState[];
  generateId(): string;
}

// ── In-memory implementation ──────────────────────────────────────────────────

export class InMemoryConversationStateStore implements ConversationStateStore {
  private readonly store = new Map<string, SessionState>();
  private readonly ttlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number = 1_800_000) {
    this.ttlMs = ttlMs;
    this.startCleanup();
  }

  get(sessionId: string): SessionState | null {
    return this.store.get(sessionId) ?? null;
  }

  set(sessionId: string, state: SessionState): void {
    this.store.set(sessionId, state);
  }

  update(sessionId: string, patch: Partial<SessionState>): SessionState | null {
    const existing = this.store.get(sessionId);
    if (!existing) return null;
    const updated: SessionState = {
      ...existing,
      ...patch,
      lastActivityAt: Date.now(),
    };
    this.store.set(sessionId, updated);
    return updated;
  }

  delete(sessionId: string): boolean {
    return this.store.delete(sessionId);
  }

  list(): SessionState[] {
    return Array.from(this.store.values());
  }

  generateId(): string {
    return randomUUID();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, state] of this.store) {
        if (now - state.lastActivityAt > this.ttlMs) {
          this.store.delete(id);
        }
      }
    }, 60_000);
    // Allow process to exit even if cleanup is still scheduled
    this.cleanupInterval.unref?.();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
