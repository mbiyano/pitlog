import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { config } from '../config/env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers["x-gateway-token"]',
  'sdpOffer',
  'sdpAnswer',
  'sdp',
  'ephemeralToken',
  'client_secret',
  '*.api_key',
  '*.apiKey',
  '*.token',
  '*.secret',
  'OPENAI_API_KEY',
  'MCP_AUTH_TOKEN',
  'GATEWAY_BEARER_TOKEN',
];

// ── Persistent log file ────────────────────────────────────────────────────────
// Logs are written to <project-root>/logs/voice-gateway.log as structured JSON.
// The directory is created on startup if it does not exist.
const __dirname = dirname(fileURLToPath(import.meta.url));
const logsDir = join(__dirname, '..', '..', 'logs');
mkdirSync(logsDir, { recursive: true });
const logFilePath = join(logsDir, 'voice-gateway.log');

// In development: pretty stdout + JSON file.  In production: just JSON file.
const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino/file',
    options: { destination: logFilePath, mkdir: true },
    level: config.LOG_LEVEL,
  },
];

if (config.NODE_ENV === 'development') {
  targets.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
    level: config.LOG_LEVEL,
  });
} else {
  // Production: also send JSON to stdout
  targets.push({
    target: 'pino/file',
    options: { destination: 1 }, // fd 1 = stdout
    level: config.LOG_LEVEL,
  });
}

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  transport: { targets },
});

export type Logger = pino.Logger;

export interface LogContext {
  sessionId?: string;
  callId?: string;
  requestId?: string;
  tool?: string;
  [key: string]: unknown;
}

export function createChildLogger(ctx: LogContext): Logger {
  return logger.child(ctx);
}
