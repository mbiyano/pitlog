import type { Env } from '../config/env.js';
import type { Logger } from '../observability/logger.js';
import { HttpMcpAdapter } from './http-mcp-adapter.js';
import type { McpAdapter } from './mcp-types.js';
import { MockMcpAdapter } from './mock-mcp-adapter.js';

export function createMcpAdapter(cfg: Env, log: Logger): McpAdapter {
  if (cfg.USE_MOCK_MCP) {
    log.info('Using MockMcpAdapter (USE_MOCK_MCP=true)');
    return new MockMcpAdapter();
  }

  if (!cfg.MCP_SERVER_BASE_URL) {
    throw new Error('MCP_SERVER_BASE_URL is required when USE_MOCK_MCP=false');
  }

  log.info({ baseUrl: cfg.MCP_SERVER_BASE_URL }, 'Using HttpMcpAdapter');
  return new HttpMcpAdapter(cfg.MCP_SERVER_BASE_URL, cfg.MCP_AUTH_TOKEN ?? '', log);
}
