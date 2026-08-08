import { describe, expect, it } from 'vitest';
import { SYSTEM_INSTRUCTIONS } from '../src/realtime/workshop-assistant.js';

describe('Workshop assistant instructions', () => {
  it('requires a plate read-back before using tools', () => {
    expect(SYSTEM_INSTRUCTIONS).toContain('repetila separando letras y números');
    expect(SYSTEM_INSTRUCTIONS).toContain('Esperá una confirmación o corrección');
  });

  it('keeps identifier and write confirmations separate', () => {
    expect(SYSTEM_INSTRUCTIONS).toContain(
      'La confirmación de una patente o un nombre solo valida cómo se escuchó ese dato',
    );
    expect(SYSTEM_INSTRUCTIONS).toContain('¿Confirmás que guarde estos datos?');
  });

  it('only reports a verified write as successful', () => {
    expect(SYSTEM_INSTRUCTIONS).toContain('"persistenciaVerificada" vale true');
    expect(SYSTEM_INSTRUCTIONS).toContain('No pude verificar que se haya guardado');
  });

  it('uses a neutral tone without encouraging workshop slang', () => {
    expect(SYSTEM_INSTRUCTIONS).toContain('evitá modismos regionales, lunfardo y muletillas');
    expect(SYSTEM_INSTRUCTIONS).not.toContain('como un pibe que labura');
  });
});
