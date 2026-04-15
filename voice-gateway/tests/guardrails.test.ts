import { describe, it, expect, beforeEach } from 'vitest';
import { GuardrailsPolicy } from '../src/policies/guardrails.js';

function makeGuardrails(maxCalls = 5): GuardrailsPolicy {
  return new GuardrailsPolicy({ maxToolCallsPerTurn: maxCalls });
}

describe('GuardrailsPolicy', () => {
  describe('checkToolCall', () => {
    it('passes a valid read tool with valid args', () => {
      const g = makeGuardrails();
      const result = g.checkToolCall('buscar_auto_por_patente', { patente: 'ABC123' });
      expect(result.status).toBe('pass');
    });

    it('passes a valid write tool with valid args', () => {
      const g = makeGuardrails();
      const result = g.checkToolCall('crear_auto', {
        patente: 'AB123CD',
        marca: 'Ford',
        modelo: 'Fiesta',
        anio: 2018,
        clienteId: 'cliente-1',
      });
      expect(result.status).toBe('pass');
    });

    it('blocks a tool not in the allowed list', () => {
      const g = makeGuardrails();
      const result = g.checkToolCall('delete_everything', {});
      expect(result.status).toBe('block');
      expect(result.reason).toContain('not in the allowed list');
    });

    it('blocks a tool call with invalid plate', () => {
      const g = makeGuardrails();
      const result = g.checkToolCall('buscar_auto_por_patente', { patente: '12345' });
      expect(result.status).toBe('block');
      expect(result.reason).toContain('Invalid arguments');
    });

    it('blocks a tool call with invalid args (missing required field)', () => {
      const g = makeGuardrails();
      const result = g.checkToolCall('crear_auto', { patente: 'ABC123' });
      expect(result.status).toBe('block');
    });

    it('blocks after exceeding per-turn limit', () => {
      const g = makeGuardrails(2);
      g.checkToolCall('buscar_auto_por_patente', { patente: 'ABC123' });
      g.checkToolCall('buscar_auto_por_patente', { patente: 'ABC123' });
      const result = g.checkToolCall('buscar_auto_por_patente', { patente: 'ABC123' });
      expect(result.status).toBe('block');
      expect(result.reason).toContain('Rate limit');
    });
  });

  describe('resetTurn', () => {
    it('resets the per-turn call counter', () => {
      const g = makeGuardrails(1);
      g.checkToolCall('buscar_auto_por_patente', { patente: 'ABC123' });
      expect(g.getToolCallCount()).toBe(1);

      g.resetTurn();
      expect(g.getToolCallCount()).toBe(0);

      const result = g.checkToolCall('buscar_auto_por_patente', { patente: 'ABC123' });
      expect(result.status).toBe('pass');
    });
  });

  describe('checkTranscript', () => {
    it('passes normal workshop speech', () => {
      const g = makeGuardrails();
      const result = g.checkTranscript('el auto tiene un problema en el motor');
      expect(result.status).toBe('pass');
    });
  });
});
