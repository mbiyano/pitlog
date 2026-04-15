export type EventDirection = 'inbound' | 'outbound';

export interface JournalEntry {
  ts: number;
  direction: EventDirection;
  type: string;
  payload: unknown;
}

export interface JournalSummary {
  totalEvents: number;
  firstEventAt: number | null;
  lastEventAt: number | null;
  countsByType: Record<string, number>;
}

/**
 * Circular buffer of Realtime events for a single session.
 * Used for debugging, observability, and the /events endpoint.
 */
export class RealtimeEventJournal {
  private readonly buffer: (JournalEntry | undefined)[];
  private readonly maxSize: number;
  private head = 0;
  private count = 0;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
    this.buffer = new Array<JournalEntry | undefined>(maxSize).fill(undefined);
  }

  append(direction: EventDirection, type: string, payload: unknown): void {
    const entry: JournalEntry = { ts: Date.now(), direction, type, payload };
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) this.count++;
  }

  /**
   * Return the most recent `n` events in chronological order.
   */
  getRecent(n?: number): JournalEntry[] {
    const limit = Math.min(n ?? this.count, this.count);
    const result: JournalEntry[] = [];

    // Walk backwards from head
    let idx = (this.head - 1 + this.maxSize) % this.maxSize;
    for (let i = 0; i < this.count && result.length < limit; i++) {
      const entry = this.buffer[idx];
      if (entry) result.unshift(entry);
      idx = (idx - 1 + this.maxSize) % this.maxSize;
    }

    return result;
  }

  toSummary(): JournalSummary {
    const all = this.getRecent();
    const countsByType: Record<string, number> = {};
    for (const entry of all) {
      countsByType[entry.type] = (countsByType[entry.type] ?? 0) + 1;
    }
    return {
      totalEvents: this.count,
      firstEventAt: all[0]?.ts ?? null,
      lastEventAt: all[all.length - 1]?.ts ?? null,
      countsByType,
    };
  }

  get size(): number {
    return this.count;
  }
}
