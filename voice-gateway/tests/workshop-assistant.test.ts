import { describe, expect, it } from 'vitest';
import { SYSTEM_INSTRUCTIONS } from '../src/realtime/workshop-assistant.js';

describe('Workshop assistant instructions', () => {
  it('executes clear requests without a redundant confirmation', () => {
    expect(SYSTEM_INSTRUCTIONS).toContain('ya autoriza esa operación');
    expect(SYSTEM_INSTRUCTIONS).toContain('No pidas una confirmación adicional');
    expect(SYSTEM_INSTRUCTIONS).not.toContain('¿Confirmás que guarde estos datos?');
  });

  it('clarifies only genuinely ambiguous name or plate characters', () => {
    expect(SYSTEM_INSTRUCTIONS).toContain('Si dudás de una o más letras, no adivines');
    expect(SYSTEM_INSTRUCTIONS).toContain('Preguntá solo por la parte ambigua');
    expect(SYSTEM_INSTRUCTIONS).toContain('aceptalo y usalo sin repetirlo ni deletrearlo');
  });

  it('suppresses action announcements and tool preambles', () => {
    expect(SYSTEM_INSTRUCTIONS).toContain('No anuncies lo que vas a hacer');
    expect(SYSTEM_INSTRUCTIONS).toContain('Llamá a las herramientas sin preámbulos');
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
