import { config } from './config/env.js';
import { logger } from './observability/logger.js';
import { createMcpAdapter } from './mcp/mcp-client.js';
import { InMemoryConversationStateStore } from './conversation/conversation-state-store.js';
import { SessionManager } from './realtime/session-manager.js';
import { startServer } from './api/http-server.js';

async function main(): Promise<void> {
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      model: config.OPENAI_REALTIME_MODEL,
      voice: config.OPENAI_REALTIME_VOICE,
      useMockMcp: config.USE_MOCK_MCP,
    },
    'Starting PitLog gateway',
  );

  const stateStore = new InMemoryConversationStateStore(config.SESSION_TTL_MS);
  const mcpAdapter = createMcpAdapter(config, logger);
  const sessionManager = new SessionManager(config, mcpAdapter, stateStore, logger);

  await startServer(config, sessionManager);
}

main().catch((err: Error) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Fatal startup error');
  process.exit(1);
});
