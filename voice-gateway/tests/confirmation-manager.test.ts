import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmationManager } from '../src/conversation/confirmation-manager.js';
import type { Logger } from '../src/observability/logger.js';

const noopLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

function makeManager(): ConfirmationManager {
  return new ConfirmationManager(noopLog);
}

describe('ConfirmationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectIntent', () => {
    it('detects "sí guardalo" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('sí guardalo')).toBe('confirm');
    });

    it('detects "confirmo" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('confirmo')).toBe('confirm');
    });

    it('detects "dale" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('dale')).toBe('confirm');
    });

    it('detects "listo" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('listo')).toBe('confirm');
    });

    it('detects "guardalo" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('guardalo')).toBe('confirm');
    });

    it('detects "si" (without accent) as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('si')).toBe('confirm');
    });

    it('detects "si guardalo" (without accent) as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('si guardalo')).toBe('confirm');
    });

    it('detects "Si, dale" (without accent) as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('Si, dale')).toBe('confirm');
    });

    it('detects "de una" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('de una')).toBe('confirm');
    });

    it('detects "metele" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('metele')).toBe('confirm');
    });

    it('detects "mandale" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('mandale')).toBe('confirm');
    });

    it('detects "joya" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('joya')).toBe('confirm');
    });

    it('detects "perfecto" as confirm', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('perfecto')).toBe('confirm');
    });

    it('detects "para" (without accent) as cancel', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('para')).toBe('cancel');
    });

    it('detects "cancelá" as cancel', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('cancelá')).toBe('cancel');
    });

    it('detects "no lo guardes" as cancel', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('no lo guardes')).toBe('cancel');
    });

    it('detects "dejalo" as cancel', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('dejalo')).toBe('cancel');
    });

    it('detects "no" as cancel', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('no')).toBe('cancel');
    });

    it('returns "none" for unrelated utterance', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('el auto es un ford focus')).toBe('none');
    });

    it('returns "none" for empty string', () => {
      const mgr = makeManager();
      expect(mgr.detectIntent('')).toBe('none');
    });
  });

  describe('setPending / hasPending / confirm / cancel', () => {
    it('setPending marks manager as having a pending action', () => {
      const mgr = makeManager();
      expect(mgr.hasPending()).toBe(false);

      mgr.setPending('crear_auto', { patente: 'ABC123' }, 'Registrar auto ABC123.', 'item-1', 'call-1');
      expect(mgr.hasPending()).toBe(true);
    });

    it('confirm returns the pending action and clears state', () => {
      const mgr = makeManager();
      mgr.setPending('crear_auto', { patente: 'ABC123' }, 'Registrar auto.', 'item-1', 'call-1');

      const action = mgr.confirm();
      expect(action).not.toBeNull();
      expect(action?.toolName).toBe('crear_auto');
      expect(mgr.hasPending()).toBe(false);
    });

    it('cancel returns the pending action and clears state', () => {
      const mgr = makeManager();
      mgr.setPending('crear_auto', { patente: 'ABC123' }, 'Registrar auto.', 'item-1', 'call-1');

      const action = mgr.cancel();
      expect(action?.toolName).toBe('crear_auto');
      expect(mgr.hasPending()).toBe(false);
    });

    it('confirm returns null when nothing is pending', () => {
      const mgr = makeManager();
      expect(mgr.confirm()).toBeNull();
    });

    it('cancel returns null when nothing is pending', () => {
      const mgr = makeManager();
      expect(mgr.cancel()).toBeNull();
    });

    it('replaces previous pending when setPending called twice', () => {
      const mgr = makeManager();
      mgr.setPending('crear_auto', {}, 'Auto.', 'item-1', 'call-1');
      mgr.setPending('crear_cliente', {}, 'Cliente.', 'item-2', 'call-2');

      const action = mgr.confirm();
      expect(action?.toolName).toBe('crear_cliente');
    });
  });

  describe('timeout', () => {
    it('calls onTimeout callback and clears pending after timeout', async () => {
      vi.useFakeTimers();
      const mgr = makeManager();
      const onTimeout = vi.fn();

      mgr.setPending('crear_auto', {}, 'Auto.', 'item-1', 'call-1', 1000, onTimeout);
      expect(mgr.hasPending()).toBe(true);

      vi.advanceTimersByTime(1001);

      expect(mgr.hasPending()).toBe(false);
      expect(onTimeout).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });
  });
});
