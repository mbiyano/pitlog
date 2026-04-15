import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmationManager } from '../src/conversation/confirmation-manager.js';
import { GuardrailsPolicy } from '../src/policies/guardrails.js';
import { dispatchTool } from '../src/mcp/mcp-tool-registry.js';
import { MockMcpAdapter } from '../src/mcp/mcp-client.js';

// These tests simulate the logic of SidebandController without
// creating a real WebSocket connection to OpenAI.

const mockAdapter = new MockMcpAdapter();

describe('Tool dispatch via dispatchTool', () => {
  it('dispatches buscar_auto_por_patente and returns auto', async () => {
    const result = await dispatchTool(
      'buscar_auto_por_patente',
      { patente: 'ABC123' },
      mockAdapter,
    );
    expect(result.success).toBe(true);
    expect(result.result).not.toBeNull();
  });

  it('returns error for unknown tool name', async () => {
    const result = await dispatchTool('unknown_tool', {}, mockAdapter);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not registered');
  });

  it('returns error for invalid args', async () => {
    const result = await dispatchTool(
      'buscar_auto_por_patente',
      { patente: 'NOT_VALID_PLATE!!!' },
      mockAdapter,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('dispatches crear_visita_taller and returns visita', async () => {
    const result = await dispatchTool(
      'crear_visita_taller',
      { autoId: 'auto-1', fecha: '2024-12-15', kilometraje: 95000 },
      mockAdapter,
    );
    expect(result.success).toBe(true);
    const visita = result.result as { estado: string };
    expect(visita.estado).toBe('abierta');
  });
});

describe('Confirmation + guardrail interaction', () => {
  let mgr: ConfirmationManager;
  let guardrails: GuardrailsPolicy;

  const noopLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    mgr = new ConfirmationManager(noopLog as never);
    guardrails = new GuardrailsPolicy({ maxToolCallsPerTurn: 5 });
  });

  it('guardrail passes then confirmation set, then confirmed and dispatched', async () => {
    const toolName = 'crear_auto';
    const args = { patente: 'ZZ999XX', marca: 'Ford', modelo: 'Ka', anio: 2010, clienteId: 'cliente-1' };

    const guardResult = guardrails.checkToolCall(toolName, args);
    expect(guardResult.status).toBe('pass');

    mgr.setPending(toolName, args, 'Registrar auto ZZ999XX Ford Ka.', 'item-1', 'call-1');
    expect(mgr.hasPending()).toBe(true);

    // Simulate user saying "sí guardalo"
    const intent = mgr.detectIntent('sí guardalo');
    expect(intent).toBe('confirm');

    const pending = mgr.confirm();
    expect(pending).not.toBeNull();
    expect(mgr.hasPending()).toBe(false);

    const result = await dispatchTool(pending!.toolName, pending!.args, mockAdapter);
    expect(result.success).toBe(true);
  });

  it('guardrail blocks disallowed tool before confirmation is set', () => {
    const guardResult = guardrails.checkToolCall('drop_database', {});
    expect(guardResult.status).toBe('block');
    // Never reaches confirmation
    expect(mgr.hasPending()).toBe(false);
  });

  it('cancellation clears pending without dispatch', async () => {
    mgr.setPending('crear_cliente', { nombre: 'Test' }, 'Cliente Test.', 'item-1', 'call-1');

    const intent = mgr.detectIntent('cancelá');
    expect(intent).toBe('cancel');

    const pending = mgr.cancel();
    expect(pending?.toolName).toBe('crear_cliente');
    expect(mgr.hasPending()).toBe(false);
  });
});

describe('Realtime event handling — session disconnect during pending confirmation', () => {
  it('destroy clears pending confirmation', () => {
    const noopLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };

    const mgr = new ConfirmationManager(noopLog as never);
    mgr.setPending('crear_auto', {}, 'Auto.', 'item-1', 'call-1', 60_000);
    expect(mgr.hasPending()).toBe(true);

    mgr.destroy();
    expect(mgr.hasPending()).toBe(false);
  });
});
