// Set minimal env vars for tests before any module is imported
process.env['OPENAI_API_KEY'] = 'sk-test-key-for-unit-tests';
process.env['NODE_ENV'] = 'test';
process.env['USE_MOCK_MCP'] = 'true';
process.env['LOG_LEVEL'] = 'fatal';
