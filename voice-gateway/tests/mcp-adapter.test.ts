import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockMcpAdapter, HttpMcpAdapter } from '../src/mcp/mcp-client.js';
import type { Logger } from '../src/observability/logger.js';

vi.mock('undici', () => ({
  fetch: vi.fn(),
}));

const noopLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

describe('MockMcpAdapter', () => {
  let adapter: MockMcpAdapter;

  beforeEach(() => {
    adapter = new MockMcpAdapter();
  });

  describe('buscarAutoPorPatente', () => {
    it('finds existing auto by exact plate', async () => {
      const auto = await adapter.buscarAutoPorPatente('ABC123');
      expect(auto).not.toBeNull();
      expect(auto?.marca).toBe('Ford');
    });

    it('finds existing auto with spaces in plate', async () => {
      const auto = await adapter.buscarAutoPorPatente('ABC 123');
      expect(auto).not.toBeNull();
    });

    it('is case-insensitive', async () => {
      const auto = await adapter.buscarAutoPorPatente('abc123');
      expect(auto).not.toBeNull();
    });

    it('returns null for unknown plate', async () => {
      const auto = await adapter.buscarAutoPorPatente('ZZZ999');
      expect(auto).toBeNull();
    });
  });

  describe('crearAuto', () => {
    it('creates a new auto and returns it with an id', async () => {
      const auto = await adapter.crearAuto({
        patente: 'NEW001',
        marca: 'Toyota',
        modelo: 'Corolla',
        anio: 2022,
      });
      expect(auto.id).toBeTruthy();
      expect(auto.patente).toBe('NEW001');
    });

    it('makes new auto findable by plate', async () => {
      await adapter.crearAuto({ patente: 'FIND01', marca: 'Honda', modelo: 'Civic', anio: 2021 });
      const found = await adapter.buscarAutoPorPatente('FIND01');
      expect(found?.marca).toBe('Honda');
    });
  });

  describe('buscarCliente', () => {
    it('finds client by name', async () => {
      const results = await adapter.buscarCliente('Juan');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.nombre).toContain('Juan');
    });

    it('returns empty array for unknown query', async () => {
      const results = await adapter.buscarCliente('xyzunknown123');
      expect(results).toHaveLength(0);
    });
  });

  describe('crearVisitaTaller', () => {
    it('creates a visit and returns it with estado abierta', async () => {
      const visita = await adapter.crearVisitaTaller({
        autoId: 'auto-1',
        fecha: '2024-12-01',
        kilometraje: 90000,
      });
      expect(visita.id).toBeTruthy();
      expect(visita.estado).toBe('abierta');
      expect(visita.trabajos).toHaveLength(0);
    });
  });

  describe('agregarTrabajoAVisita', () => {
    it('adds a trabajo to an existing visita', async () => {
      const visita = await adapter.crearVisitaTaller({
        autoId: 'auto-1',
        fecha: '2024-12-01',
      });
      const trabajo = await adapter.agregarTrabajoAVisita({
        visitaId: visita.id,
        descripcion: 'Cambio de correa',
        costo: 25000,
      });
      expect(trabajo.id).toBeTruthy();
      expect(trabajo.descripcion).toBe('Cambio de correa');
    });

    it('throws when visitaId does not exist', async () => {
      await expect(
        adapter.agregarTrabajoAVisita({ visitaId: 'nonexistent', descripcion: 'test' }),
      ).rejects.toThrow();
    });
  });

  describe('obtenerHistorialAuto', () => {
    it('returns historial for known auto', async () => {
      const historial = await adapter.obtenerHistorialAuto('auto-1');
      expect(historial.autoId).toBe('auto-1');
      expect(Array.isArray(historial.visitas)).toBe(true);
    });

    it('throws for unknown auto', async () => {
      await expect(adapter.obtenerHistorialAuto('unknown-auto')).rejects.toThrow();
    });
  });

  describe('obtenerUltimoService', () => {
    it('returns the last closed service', async () => {
      const service = await adapter.obtenerUltimoService('auto-1');
      expect(service).not.toBeNull();
      expect(service?.autoId).toBe('auto-1');
    });

    it('returns null for auto with no closed visits', async () => {
      const auto = await adapter.crearAuto({
        patente: 'NEW999',
        marca: 'Test',
        modelo: 'Test',
        anio: 2020,
      });
      const service = await adapter.obtenerUltimoService(auto.id);
      expect(service).toBeNull();
    });
  });

  describe('redactarMensajeCliente', () => {
    it('returns a mensaje for recordatorio_service', async () => {
      const result = await adapter.redactarMensajeCliente({
        clienteId: 'cliente-1',
        tipo: 'recordatorio_service',
      });
      expect(result.mensaje).toContain('service');
    });

    it('includes client name in message', async () => {
      const result = await adapter.redactarMensajeCliente({
        clienteId: 'cliente-1',
        tipo: 'generico',
        detalles: 'test',
      });
      expect(result.mensaje).toContain('Juan');
    });
  });
});

describe('HttpMcpAdapter', () => {
  it('throws when MCP server returns non-OK status', async () => {
    const { fetch: mockFetch } = await import('undici');
    vi.mocked(mockFetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as unknown as Awaited<ReturnType<typeof mockFetch>>);

    const adapter = new HttpMcpAdapter('http://localhost:4000', 'test-token', noopLog);
    await expect(adapter.buscarAutoPorPatente('ABC123')).rejects.toThrow('500');
  });
});
