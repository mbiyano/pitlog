import { TOOL_DEFINITIONS } from '../mcp/mcp-tool-registry.js';

/**
 * Configuration shared by the REST session bootstrap and the sideband update.
 * Keeping it here prevents the browser-direct and gateway-relayed flows from
 * silently drifting apart.
 */
export function buildRealtimeSessionConfig(voice: string, instructions: string) {
  return {
    voice,
    modalities: ['audio', 'text'],
    instructions,
    tools: TOOL_DEFINITIONS,
    tool_choice: 'auto',
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.65,
      prefix_padding_ms: 500,
      silence_duration_ms: 1200,
      create_response: true,
    },
    temperature: 0.8,
    max_response_output_tokens: 'inf',
  };
}
