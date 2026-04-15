import WebSocket from 'ws';
import type { Logger } from '../observability/logger.js';
import type { Env } from '../config/env.js';
import type { McpAdapter } from '../mcp/mcp-client.js';
import type { ConversationStateStore } from '../conversation/conversation-state-store.js';
import { ConfirmationManager } from '../conversation/confirmation-manager.js';
import { GuardrailsPolicy } from '../policies/guardrails.js';
import { RealtimeEventJournal } from './realtime-event-journal.js';
import {
  WRITE_TOOLS,
  READ_TOOLS,
  TOOL_DEFINITIONS,
  dispatchTool,
  buildConfirmationSummaryEs,
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

interface TranscriptDoneEvent extends RealtimeBaseEvent {
  type: 'conversation.item.input_audio_transcription.completed';
  item_id: string;
  transcript: string;
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
  | TranscriptDoneEvent
  | ResponseDoneEvent
  | ErrorEvent
  | RealtimeBaseEvent;

// ── Workshop assistant system instructions ────────────────────────────────────

export const SYSTEM_INSTRUCTIONS = `Sos el asistente de voz del taller mecánico. Hablás en español argentino rioplatense, como un pibe que labura en el taller. Usás voseo siempre ("vos tenés", "decime", "avisame"). Tuteo NUNCA. Sos directo, copado y no le das vueltas a las cosas.

Tu rol es ayudar al mecánico a registrar laburos en los autos que entran al taller.

Cosas que podés hacer:
- Buscar un auto por patente y ver qué se le hizo antes
- Registrar que un auto entró al taller (visita)
- Agregar los laburos que se le hicieron a una visita
- Buscar o registrar clientes
- Crear recordatorios de service
- Contestar preguntas sobre el estado de un vehículo

Reglas que tenés que seguir sí o sí:
- Nunca inventés una patente, kilometraje, cliente, servicio ni fecha. Si no te lo dicen, preguntá.
- Siempre pedí confirmación antes de guardar o tocar cualquier dato. Hacé un resumen cortito y claro.
- Si te falta info, preguntá puntualmente qué necesitás antes de llamar a cualquier herramienta.
- Si hay algo confuso (tipo dos autos con la misma patente o no encontrás nada), avisá y pedí que te aclaren.
- Hablá siempre como en una charla, nada de listas ni textos formales. Frases cortas, al grano.
- Cuando vayas a guardar algo, decí algo como: "Listo, te anoto [resumen]. ¿Lo guardo?"
- Si el mecánico confirma, ejecutá la herramienta. Si cancela, decí "Dale, no guardé nada."
- Usá expresiones argentinas naturales: "dale", "listo", "joya", "de una", "bancame un toque", "ahí lo busco".

IMPORTANTÍSIMO — verificación de resultados (NUNCA saltearte esto):
- Cuando llamás a una herramienta, SIEMPRE leé el resultado COMPLETO que te devuelve ANTES de decir nada.
- ÉXITO: El resultado tiene un campo "id" y NO tiene campo "error" ni "status": "OPERACION_FALLIDA". Solo en este caso decile al mecánico que se guardó.
- ERROR: Si el resultado contiene "error", "OPERACION_FALLIDA", o es null/vacío, LA OPERACIÓN FALLÓ. Decile al mecánico exactamente qué error hubo. NUNCA digas "listo" ni "ya lo guardé".
- SIN RESPUESTA: Si no recibiste resultado de la herramienta, decí "Bancá, parece que no se pudo guardar. ¿Querés que lo intente de nuevo?"
- REGLA DE ORO: Si tenés CUALQUIER duda sobre si la operación fue exitosa, decí que hubo un problema. Es mejor avisar un error de más que mentirle al mecánico diciéndole que se guardó algo que no se guardó.

FLUJO OBLIGATORIO — cliente antes que vehículo:
- SIEMPRE que vayas a registrar un auto nuevo (crear_auto), PRIMERO verificá que el cliente existe o crealo.
- Paso 1: Preguntale al mecánico el nombre del cliente (dueño del auto).
- Paso 2: Usá buscar_cliente para ver si ya está en el sistema.
- Paso 3: Si no existe, creá al cliente con crear_cliente y esperá confirmación.
- Paso 4: RECIÉN AHÍ creá el auto con crear_auto pasando el clienteId que obtuviste.
- NUNCA llames a crear_auto sin un clienteId válido. La herramienta lo exige.
- Si te equivocaste y asignaste el auto a otro cliente, usá actualizar_auto para corregirlo.

Ejemplos de confirmación válidos del mecánico: "sí guardalo", "confirmo", "dale", "listo", "de una", "metele".
Ejemplos de cancelación: "cancelá", "no lo guardes", "dejalo", "pará", "no".

No hagas suposiciones. No inventes datos. Preguntá lo que te falta.`;

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
  private readonly confirmationManager: ConfirmationManager;
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
    this.confirmationManager = new ConfirmationManager(this.log);
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
        'OpenAI-Beta': 'realtime=v1',
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
      session: {
        instructions: SYSTEM_INSTRUCTIONS,
        voice: this.config.OPENAI_REALTIME_VOICE,
        modalities: ['audio', 'text'],
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.65,
          prefix_padding_ms: 500,
          silence_duration_ms: 1200,
          create_response: true,
        },
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 'inf',
      },
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

      case 'conversation.item.input_audio_transcription.completed':
        void this.handleTranscript(event as TranscriptDoneEvent);
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
      return;
    }

    // Guardrail check
    const guardrailResult = this.guardrails.checkToolCall(name, args);
    if (guardrailResult.status === 'block') {
      log.warn({ reason: guardrailResult.reason }, 'Tool call blocked by guardrails');
      this.sendFunctionOutput(item_id, realtimeCallId, {
        error: guardrailResult.reason ?? 'Operación no permitida.',
      });
      return;
    }

    const toolName = name as ToolName;

    if (WRITE_TOOLS.has(toolName)) {
      await this.initiateConfirmation(toolName, args as Record<string, unknown>, item_id, realtimeCallId);
    } else if (READ_TOOLS.has(toolName)) {
      await this.executeToolDirectly(toolName, args, item_id, realtimeCallId, log);
    }
  }

  private async initiateConfirmation(
    toolName: ToolName,
    args: Record<string, unknown>,
    itemId: string,
    realtimeCallId: string,
  ): Promise<void> {
    const summaryEs = buildConfirmationSummaryEs(toolName, args);

    this.confirmationManager.setPending(
      toolName,
      args,
      summaryEs,
      itemId,
      realtimeCallId,
      60_000,
      () => {
        // Timeout handler: tell the model the confirmation expired
        this.sendMessage(
          'El tiempo de confirmación expiró. No guardé nada. Si querés intentarlo de nuevo, avisame.',
        );
      },
    );

    this.stateStore.update(this.sessionId, {
      pendingConfirmation: this.confirmationManager.getPending(),
    });

    this.log.info({ toolName, summaryEs }, 'Awaiting user confirmation for write op');

    // Return a pending result to the model so it reads the summary aloud
    this.sendFunctionOutput(itemId, realtimeCallId, {
      status: 'awaiting_confirmation',
      summary: summaryEs,
      instruction:
        'Leé este resumen en voz alta y preguntale al mecánico si confirma: "' +
        summaryEs +
        ' ¿Lo guardamos?"',
    });

    // Trigger a new response so the model reads the summary
    this.send({
      type: 'response.create',
      response: { modalities: ['audio', 'text'] },
    });
    this.journal.append('outbound', 'response.create', { reason: 'awaiting_confirmation' });
  }

  private async executeToolDirectly(
    toolName: ToolName,
    args: unknown,
    itemId: string,
    realtimeCallId: string,
    log: Logger,
  ): Promise<void> {
    const start = Date.now();
    log.info('Executing read tool');

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
  }

  private async handleTranscript(event: TranscriptDoneEvent): Promise<void> {
    const { transcript } = event;
    this.log.debug({ transcript }, 'Transcript received');

    if (!this.confirmationManager.hasPending()) return;

    const intent = this.confirmationManager.detectIntent(transcript);
    this.log.info({ intent, transcript }, 'Confirmation intent detected');

    if (intent === 'confirm') {
      const pending = this.confirmationManager.confirm();
      if (!pending) return;

      this.stateStore.update(this.sessionId, { pendingConfirmation: null });

      const start = Date.now();
      const result = await dispatchTool(pending.toolName, pending.args, this.mcpAdapter);
      const elapsed = Date.now() - start;

      if (!result.success) {
        this.log.error({ tool: pending.toolName, error: result.error, elapsed }, 'Confirmed tool execution failed');
        this.sendMessage(
          `Hubo un error al guardar: ${result.error ?? 'error desconocido'}. ¿Querés intentarlo de nuevo?`,
        );
      } else {
        this.log.info({ tool: pending.toolName, elapsed }, 'Confirmed tool executed successfully');
        this.stateStore.update(this.sessionId, { lastMcpResult: result.result });
        // The original call_id already received its function output (awaiting_confirmation).
        // Inject the success result as a message so the model acknowledges the save.
        const resultSummary = JSON.stringify(result.result);
        this.sendMessage(
          `[Sistema] La operación "${pending.toolName}" se ejecutó correctamente. Resultado: ${resultSummary}. Avisale al mecánico que se guardó.`,
        );
      }
    } else if (intent === 'cancel') {
      this.confirmationManager.cancel();
      this.stateStore.update(this.sessionId, { pendingConfirmation: null });
      this.log.info('User cancelled pending action');
      this.sendMessage('Entendido, no guardé nada.');
    }
    // 'none' → wait for clearer utterance
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

  private sendMessage(textEs: string): void {
    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: textEs }],
      },
    };
    this.send(event);
    this.send({ type: 'response.create', response: { modalities: ['audio', 'text'] } });
    this.journal.append('outbound', 'conversation.item.create', { type: 'system_message' });
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
    this.confirmationManager.destroy();
    if (this.ws) {
      this.ws.close(1000, reason ?? 'session ended');
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConfirmationManager(): ConfirmationManager {
    return this.confirmationManager;
  }

  getGuardrails(): GuardrailsPolicy {
    return this.guardrails;
  }
}
