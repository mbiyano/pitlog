import WebSocket from 'ws';
import type { Logger } from '../observability/logger.js';
import type { Env } from '../config/env.js';
import type { McpAdapter } from '../mcp/mcp-client.js';
import type { ConversationStateStore } from '../conversation/conversation-state-store.js';
import { GuardrailsPolicy } from '../policies/guardrails.js';
import type { RealtimeEventJournal } from './realtime-event-journal.js';
import { SYSTEM_INSTRUCTIONS } from './workshop-assistant.js';
import { buildRealtimeSessionConfig } from './realtime-session-config.js';
import {
  TOOL_DEFINITIONS,
  dispatchTool,
  type ToolName,
} from '../mcp/mcp-tool-registry.js';

// ── OpenAI Realtime WebSocket event types ─────────────────────────────────────

interface RealtimeBaseEvent {
  type: string;
  event_id?: string;
}

interface SessionCreatedEvent extends RealtimeBaseEvent {
  type: 'session.created';
  session: { id: string };
}

interface FunctionCallDoneEvent extends RealtimeBaseEvent {
  type: 'response.function_call_arguments.done';
  response_id: string;
  item_id: string;
  call_id: string;
  name: string;
  arguments: string;
}

interface ResponseDoneEvent extends RealtimeBaseEvent {
  type: 'response.done';
  response: { id: string; status: string };
}

interface ErrorEvent extends RealtimeBaseEvent {
  type: 'error';
  error: { type: string; message: string };
}

type RealtimeEvent =
  | SessionCreatedEvent
  | FunctionCallDoneEvent
  | ResponseDoneEvent
  | ErrorEvent
  | RealtimeBaseEvent;


export { SYSTEM_INSTRUCTIONS } from './workshop-assistant.js';

// ── SidebandController ────────────────────────────────────────────────────────

export interface SidebandControllerOptions {
  callId: string;
  realtimeSessionId: string;
  sessionId: string;
  config: Env;
  mcpAdapter: McpAdapter;
  stateStore: ConversationStateStore;
  journal: RealtimeEventJournal;
  log: Logger;
}

export class SidebandController {
  private ws: WebSocket | null = null;
  private readonly callId: string;
  private readonly realtimeSessionId: string;
  private readonly sessionId: string;
  private readonly config: Env;
  private readonly mcpAdapter: McpAdapter;
  private readonly stateStore: ConversationStateStore;
  private readonly journal: RealtimeEventJournal;
  private readonly log: Logger;
  private readonly guardrails: GuardrailsPolicy;
  private destroyed = false;
  private connectResolve?: () => void;
  private connectReject?: (err: Error) => void;

  constructor(opts: SidebandControllerOptions) {
    this.callId = opts.callId;
    this.realtimeSessionId = opts.realtimeSessionId;
    this.sessionId = opts.sessionId;
    this.config = opts.config;
    this.mcpAdapter = opts.mcpAdapter;
    this.stateStore = opts.stateStore;
    this.journal = opts.journal;
    this.log = opts.log.child({ sessionId: opts.sessionId, callId: opts.callId });
    this.guardrails = new GuardrailsPolicy({
      maxToolCallsPerTurn: opts.config.MAX_TOOL_CALLS_PER_TURN,
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.openWebSocket();
    });
  }

  private openWebSocket(): void {
    if (this.destroyed) return;

    // Prefer call_id (attaches to a specific WebRTC call), fall back to
    // session_id (attaches to the Realtime session created in step 1).
    // Never fall back to ?model= which creates a brand-new disconnected session.
    let wsUrl: string;
    if (this.callId.startsWith('rtc_')) {
      wsUrl = `wss://api.openai.com/v1/realtime?call_id=${this.callId}`;
    } else if (this.realtimeSessionId) {
      wsUrl = `wss://api.openai.com/v1/realtime?session_id=${this.realtimeSessionId}`;
    } else {
      wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.config.OPENAI_REALTIME_MODEL)}`;
      this.log.error('No call_id or realtimeSessionId — sideband will create a disconnected session');
    }

    this.log.info(
      { wsUrl: wsUrl.replace(/(call_id|session_id)=[^&]+/, '$1=[REDACTED]') },
      'Opening sideband WebSocket',
    );

    this.ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${this.config.OPENAI_API_KEY}`,
      },
    });

    this.ws.on('open', () => {
      this.log.info('Sideband WebSocket connected');
      this.journal.append('inbound', 'ws.open', {});
      this.sendSessionUpdate();
      this.connectResolve?.();
      this.connectResolve = undefined;
      this.connectReject = undefined;
    });

    this.ws.on('message', (data) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(data.toString()) as RealtimeEvent;
      } catch {
        this.log.warn('Received non-JSON message from sideband WS');
        return;
      }
      this.handleEvent(event);
    });

    this.ws.on('error', (err) => {
      this.log.error({ err: err.message }, 'Sideband WebSocket error');
      this.journal.append('inbound', 'ws.error', { message: err.message });
      this.connectReject?.(err instanceof Error ? err : new Error(String(err)));
      this.connectReject = undefined;
    });

    this.ws.on('close', (code, reason) => {
      this.log.info({ code, reason: reason.toString() }, 'Sideband WebSocket closed');
      this.journal.append('inbound', 'ws.close', { code, reason: reason.toString() });
      // No reconnect — for WebRTC sessions, tool calls are handled
      // browser-side via the data channel. The sideband is optional.
    });
  }

  private sendSessionUpdate(): void {
    // Reinforces the session config that was already set during REST session
    // creation. Sent as a single message to avoid any race between updates.
    const sessionUpdate = {
      type: 'session.update',
      session: buildRealtimeSessionConfig(
        this.config.OPENAI_REALTIME_VOICE,
        SYSTEM_INSTRUCTIONS,
      ),
    };

    this.send(sessionUpdate);
    this.journal.append('outbound', 'session.update', { voice: this.config.OPENAI_REALTIME_VOICE, toolCount: TOOL_DEFINITIONS.length });
    this.log.info({ toolCount: TOOL_DEFINITIONS.length }, 'Sent session.update with instructions and tools');
  }

  private handleEvent(event: RealtimeEvent): void {
    this.journal.append('inbound', event.type, event);
    this.log.debug({ eventType: event.type }, 'Sideband event received');

    switch (event.type) {
      case 'session.created':
        this.log.info({ realtimeSessionId: (event as SessionCreatedEvent).session.id }, 'Realtime session ready');
        break;

      case 'response.created':
        this.guardrails.resetTurn();
        break;

      case 'response.function_call_arguments.done':
        void this.handleToolCall(event as FunctionCallDoneEvent);
        break;

      case 'response.done': {
        const done = event as ResponseDoneEvent;
        this.log.info({ responseId: done.response.id, status: done.response.status }, 'Response done');
        break;
      }

      case 'error': {
        const err = event as ErrorEvent;
        this.log.error({ errorType: err.error.type, message: err.error.message }, 'Realtime error event');
        break;
      }

      default:
        // session.updated, input_audio_buffer.*, response.audio.*, etc — logged by journal
        break;
    }
  }

  private async handleToolCall(event: FunctionCallDoneEvent): Promise<void> {
    const { name, arguments: rawArgs, call_id: realtimeCallId, item_id } = event;
    const log = this.log.child({ tool: name, realtimeCallId });

    log.info('Tool call received');

    // Parse arguments
    let args: unknown;
    try {
      args = JSON.parse(rawArgs);
    } catch {
      log.error({ rawArgs }, 'Failed to parse tool arguments');
      this.sendFunctionOutput(item_id, realtimeCallId, {
        error: 'Los argumentos de la herramienta no son válidos.',
      });
      this.send({ type: 'response.create' });
      return;
    }

    // Guardrail check
    const guardrailResult = this.guardrails.checkToolCall(name, args);
    if (guardrailResult.status === 'block') {
      log.warn({ reason: guardrailResult.reason }, 'Tool call blocked by guardrails');
      this.sendFunctionOutput(item_id, realtimeCallId, {
        error: guardrailResult.reason ?? 'Operación no permitida.',
      });
      this.send({ type: 'response.create' });
      return;
    }

    const toolName = name as ToolName;

    await this.executeTool(toolName, args, item_id, realtimeCallId, log);
  }

  private async executeTool(
    toolName: ToolName,
    args: unknown,
    itemId: string,
    realtimeCallId: string,
    log: Logger,
  ): Promise<void> {
    const start = Date.now();
    log.info('Executing tool');

    const result = await dispatchTool(toolName, args, this.mcpAdapter);
    const elapsed = Date.now() - start;

    if (!result.success) {
      log.error({ error: result.error, elapsed }, 'Tool dispatch failed');
      this.sendFunctionOutput(itemId, realtimeCallId, { error: result.error });
    } else {
      log.info({ elapsed }, 'Tool dispatch succeeded');
      this.stateStore.update(this.sessionId, { lastMcpResult: result.result });
      this.sendFunctionOutput(itemId, realtimeCallId, result.result ?? null);
    }

    this.send({ type: 'response.create' });
    this.journal.append('outbound', 'response.create', { reason: 'tool_completed' });
  }

  private sendFunctionOutput(itemId: string, callId: string, output: unknown): void {
    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    };
    this.send(event);
    this.journal.append('outbound', 'conversation.item.create', { type: 'function_call_output', callId });
  }

  private send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log.warn('Attempted to send on closed sideband WS');
      return;
    }
    const raw = JSON.stringify(data);
    this.ws.send(raw);
    this.journal.append('outbound', (data as RealtimeBaseEvent).type ?? 'unknown', data);
  }

  disconnect(reason?: string): void {
    this.log.info({ reason }, 'Disconnecting sideband WebSocket');
    this.destroyed = true;
    if (this.ws) {
      this.ws.close(1000, reason ?? 'session ended');
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getGuardrails(): GuardrailsPolicy {
    return this.guardrails;
  }
}
