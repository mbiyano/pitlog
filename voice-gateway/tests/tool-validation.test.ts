import { describe, it, expect } from 'vitest';
import { TOOL_ZOD_SCHEMAS } from '../src/mcp/mcp-tool-registry.js';

describe('Tool Zod schemas', () => {
  describe('buscar_auto_por_patente', () => {
    it('accepts valid old-format plate', () => {
      const result = TOOL_ZOD_SCHEMAS.buscar_auto_por_patente.safeParse({ patente: 'ABC 123' });
      expect(result.success).toBe(true);
    });

    it('accepts valid Mercosur-format plate', () => {
      const result = TOOL_ZOD_SCHEMAS.buscar_auto_por_patente.safeParse({ patente: 'AB 123 CD' });
      expect(result.success).toBe(true);
    });

    it('rejects plate with invalid format', () => {
      const result = TOOL_ZOD_SCHEMAS.buscar_auto_por_patente.safeParse({ patente: '12345' });
      expect(result.success).toBe(false);
    });

    it('rejects missing patente', () => {
      const result = TOOL_ZOD_SCHEMAS.buscar_auto_por_patente.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('crear_auto', () => {
    const validInput = {
      patente: 'XY456ZW',
      marca: 'Renault',
      modelo: 'Sandero',
      anio: 2020,
      clienteId: 'cliente-1',
    };

    it('accepts valid input', () => {
      expect(TOOL_ZOD_SCHEMAS.crear_auto.safeParse(validInput).success).toBe(true);
    });

    it('rejects anio in the far future', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_auto.safeParse({ ...validInput, anio: 2100 });
      expect(result.success).toBe(false);
    });

    it('rejects anio before 1900', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_auto.safeParse({ ...validInput, anio: 1800 });
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_auto.safeParse({ patente: 'ABC123' });
      expect(result.success).toBe(false);
    });
  });

  describe('crear_cliente', () => {
    it('accepts valid input', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_cliente.safeParse({
        nombre: 'Juan Pérez',
        telefono: '1154321234',
      });
      expect(result.success).toBe(true);
    });

    it('rejects nombre that is too short', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_cliente.safeParse({ nombre: 'J' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid phone (non-digits)', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_cliente.safeParse({
        nombre: 'Juan Pérez',
        telefono: '011-4321-1234',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_cliente.safeParse({
        nombre: 'Juan Pérez',
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('crear_visita_taller', () => {
    it('accepts valid input', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_visita_taller.safeParse({
        autoId: 'auto-1',
        fecha: '2024-11-15',
        kilometraje: 85000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_visita_taller.safeParse({
        autoId: 'auto-1',
        fecha: '15/11/2024',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative kilometraje', () => {
      const result = TOOL_ZOD_SCHEMAS.crear_visita_taller.safeParse({
        autoId: 'auto-1',
        fecha: '2024-11-15',
        kilometraje: -100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('actualizar_trabajo', () => {
    it('accepts minimal input (just trabajoId)', () => {
      const result = TOOL_ZOD_SCHEMAS.actualizar_trabajo.safeParse({ trabajoId: 'trabajo-1' });
      expect(result.success).toBe(true);
    });

    it('accepts valid estado enum', () => {
      const result = TOOL_ZOD_SCHEMAS.actualizar_trabajo.safeParse({
        trabajoId: 'trabajo-1',
        estado: 'terminado',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid estado value', () => {
      const result = TOOL_ZOD_SCHEMAS.actualizar_trabajo.safeParse({
        trabajoId: 'trabajo-1',
        estado: 'finalizado',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('redactar_mensaje_cliente', () => {
    it('accepts valid tipo', () => {
      const result = TOOL_ZOD_SCHEMAS.redactar_mensaje_cliente.safeParse({
        clienteId: 'cliente-1',
        tipo: 'recordatorio_service',
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown tipo', () => {
      const result = TOOL_ZOD_SCHEMAS.redactar_mensaje_cliente.safeParse({
        clienteId: 'cliente-1',
        tipo: 'otro_tipo',
      });
      expect(result.success).toBe(false);
    });
  });
});
