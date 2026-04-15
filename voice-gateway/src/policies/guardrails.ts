import { ALL_TOOL_NAMES, TOOL_ZOD_SCHEMAS, type ToolName } from '../mcp/mcp-tool-registry.js';

export type GuardrailStatus = 'pass' | 'block';

export interface GuardrailResult {
  status: GuardrailStatus;
  reason?: string;
}

export interface GuardrailsOptions {
  maxToolCallsPerTurn: number;
}

export class GuardrailsPolicy {
  private toolCallCountThisTurn = 0;
  private readonly maxToolCallsPerTurn: number;

  constructor(opts: GuardrailsOptions) {
    this.maxToolCallsPerTurn = opts.maxToolCallsPerTurn;
  }

  /**
   * Check a tool call before dispatching.
   * Validates tool is allowed, args pass the schema, and per-turn rate limit.
   */
  checkToolCall(name: string, args: unknown): GuardrailResult {
    // 1. Tool must be in allowed list
    if (!ALL_TOOL_NAMES.has(name)) {
      return {
        status: 'block',
        reason: `Tool "${name}" is not in the allowed list`,
      };
    }

    // 2. Per-turn rate limit
    if (this.toolCallCountThisTurn >= this.maxToolCallsPerTurn) {
      return {
        status: 'block',
        reason: `Rate limit: maximum ${this.maxToolCallsPerTurn} tool calls per turn reached`,
      };
    }

    // 3. Zod validation (catches malformed args, hallucinated plates, etc.)
    const schema = TOOL_ZOD_SCHEMAS[name as ToolName];
    const result = schema.safeParse(args);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return {
        status: 'block',
        reason: `Invalid arguments: ${errors}`,
      };
    }

    this.toolCallCountThisTurn++;
    return { status: 'pass' };
  }

  /**
   * Check a transcript for obvious off-topic or abusive content.
   * Minimal for MVP — extend as needed.
   */
  checkTranscript(_text: string): GuardrailResult {
    return { status: 'pass' };
  }

  /**
   * Reset per-turn counters. Call this at the start of each model response turn.
   */
  resetTurn(): void {
    this.toolCallCountThisTurn = 0;
  }

  getToolCallCount(): number {
    return this.toolCallCountThisTurn;
  }
}
