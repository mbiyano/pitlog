import { randomUUID } from 'node:crypto';
import type { PendingConfirmation } from './conversation-state-store.js';
import type { Logger } from '../observability/logger.js';

export type ConfirmationIntent = 'confirm' | 'cancel' | 'none';

// Spanish Rioplatense confirmation/cancellation utterances.
// Note: \b word boundaries don't work with accented/non-ASCII chars in JS regex.
// Use (?<![a-z]) / (?![a-z]) lookarounds instead for accented words.
const CONFIRM_PATTERNS = [
  /(?<![a-z])s[ií][,.]?\s*(guardalo|guardá|guardaló|dale|confirmá|confirmo)(?![a-z])/i,
  /(?<![a-z])confirmo(?![a-z])/i,
  /(?<![a-z])confirmá(?![a-z])/i,
  /(?<![a-z])dale[,.]?\s*(guardá|guardalo|guardaló)?(?![a-z])/i,
  /(?<![a-z])exacto(?![a-z])/i,
  /(?<![a-z])correcto(?![a-z])/i,
  /(?<![a-z])listo[,.]?\s*(guardá|dale)?(?![a-z])/i,
  /(?<![a-z])adelante(?![a-z])/i,
  /(?<![a-z])guardalo(?![a-z])/i,
  /(?<![a-z])guardá(?![a-z])/i,
  /(?<![a-z])de\s+una(?![a-z])/i,
  /(?<![a-z])metele(?![a-z])/i,
  /(?<![a-z])mandale(?![a-z])/i,
  /(?<![a-z])joya(?![a-z])/i,
  /(?<![a-z])perfecto(?![a-z])/i,
  /(?<![a-z])s[ií][,.]?\s*s[ií](?![a-z])/i,
  /^s[ií]\.?$/i,
  /^dale\.?$/i,
  /^listo\.?$/i,
  /^de una\.?$/i,
];

const CANCEL_PATTERNS = [
  /(?<![a-z])cancel[aá](lo)?(?![a-z])/i,
  /(?<![a-z])no\s+lo\s+guard(e|é|es)(?![a-z])/i,
  /(?<![a-z])no\s+guard(e|é|es)(?![a-z])/i,
  /(?<![a-z])dejalo(?![a-z])/i,
  /(?<![a-z])dejal[oó](?![a-z])/i,
  /(?<![a-z])no[,.]?\s*gracias(?![a-z])/i,
  /(?<![a-z])par[aá](?![a-z])/i,
  /(?<![a-z])espera(?![a-z])/i,
  /(?<![a-z])olvida(lo)?(?![a-z])/i,
  /(?<![a-z])no(?![a-z])/i,
  /^no\.?$/i,
];

export class ConfirmationManager {
  private pending: PendingConfirmation | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private onTimeout: (() => void) | null = null;

  constructor(private readonly log: Logger) {}

  setPending(
    toolName: string,
    args: Record<string, unknown>,
    summaryEs: string,
    realtimeItemId: string,
    callId: string,
    timeoutMs: number = 60_000,
    onTimeout?: () => void,
  ): PendingConfirmation {
    this.cancelTimeout();

    const now = Date.now();
    const pending: PendingConfirmation = {
      id: randomUUID(),
      toolName,
      args,
      summaryEs,
      realtimeItemId,
      callId,
      createdAt: now,
      expiresAt: now + timeoutMs,
    };
    this.pending = pending;
    this.onTimeout = onTimeout ?? null;

    this.timeoutHandle = setTimeout(() => {
      this.log.warn(
        { toolName, pendingId: pending.id },
        'Confirmation timed out — auto-cancelling pending action',
      );
      this.pending = null;
      this.timeoutHandle = null;
      this.onTimeout?.();
      this.onTimeout = null;
    }, timeoutMs);

    return pending;
  }

  hasPending(): boolean {
    return this.pending !== null;
  }

  getPending(): PendingConfirmation | null {
    return this.pending;
  }

  detectIntent(transcript: string): ConfirmationIntent {
    const normalized = transcript.trim().toLowerCase();

    for (const pattern of CONFIRM_PATTERNS) {
      if (pattern.test(normalized)) {
        return 'confirm';
      }
    }

    for (const pattern of CANCEL_PATTERNS) {
      if (pattern.test(normalized)) {
        return 'cancel';
      }
    }

    return 'none';
  }

  confirm(): PendingConfirmation | null {
    if (!this.pending) return null;
    const action = this.pending;
    this.pending = null;
    this.cancelTimeout();
    this.log.info({ toolName: action.toolName }, 'Confirmation accepted');
    return action;
  }

  cancel(): PendingConfirmation | null {
    if (!this.pending) return null;
    const action = this.pending;
    this.pending = null;
    this.cancelTimeout();
    this.log.info({ toolName: action.toolName }, 'Confirmation cancelled by user');
    return action;
  }

  private cancelTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  destroy(): void {
    this.cancelTimeout();
    this.pending = null;
    this.onTimeout = null;
  }
}
