import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('rejects a write result that was not verified after persistence', async () => {
    const adapter = new MockMcpAdapter();
    vi.spyOn(adapter, 'crearAuto').mockResolvedValue({
      id: 'auto-unverified',
      patente: 'ZZZ999',
      marca: 'Ford',
      modelo: 'Ka',
      anio: 2010,
    });

    const result = await dispatchTool(
      'crear_auto',
      { patente: 'ZZZ999', marca: 'Ford', modelo: 'Ka', anio: 2010, clienteId: 'cliente-1' },
      adapter,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('verificar la persistencia');
  });
});

describe('Immediate write dispatch + guardrail interaction', () => {
  let guardrails: GuardrailsPolicy;

  beforeEach(() => {
    guardrails = new GuardrailsPolicy({ maxToolCallsPerTurn: 5 });
  });

  it('dispatches a requested write immediately after guardrails pass', async () => {
    const toolName = 'crear_auto';
    const args = { patente: 'ZZ999XX', marca: 'Ford', modelo: 'Ka', anio: 2010, clienteId: 'cliente-1' };

    const guardResult = guardrails.checkToolCall(toolName, args);
    expect(guardResult.status).toBe('pass');

    const result = await dispatchTool(toolName, args, mockAdapter);
    expect(result.success).toBe(true);
  });

  it('guardrail blocks a disallowed tool before dispatch', () => {
    const guardResult = guardrails.checkToolCall('drop_database', {});
    expect(guardResult.status).toBe('block');
  });
});
