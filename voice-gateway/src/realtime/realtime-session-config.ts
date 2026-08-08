import { TOOL_DEFINITIONS } from '../mcp/mcp-tool-registry.js';

/**
 * Configuration shared by the REST session bootstrap and the sideband update.
 * Keeping it here prevents the browser-direct and gateway-relayed flows from
 * silently drifting apart.
 */
export function buildRealtimeSessionConfig(voice: string, instructions: string) {
  return {
    type: 'realtime' as const,
    output_modalities: ['audio'],
    instructions,
    tools: TOOL_DEFINITIONS,
    tool_choice: 'auto',
    audio: {
      input: {
        noise_reduction: {
          type: 'near_field',
        },
        transcription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'es',
          prompt:
            'Español rioplatense. Esperá nombres, apellidos y patentes argentinas; transcribí letras y números literalmente.',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.65,
          prefix_padding_ms: 500,
          silence_duration_ms: 1200,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice,
      },
    },
    max_output_tokens: 'inf',
  };
}
