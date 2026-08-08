import type { ToolCallResult } from '../types'

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  try {
    const response = await fetch('/api/voice/tool-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: name, params: args }),
    })

    const payload = (await response.json()) as ToolCallResult

    if (!response.ok) {
      return {
        success: false,
        error: payload.error ?? `La herramienta respondió con estado ${response.status}`,
      }
    }

    if (typeof payload.success !== 'boolean') {
      return { success: false, error: 'La herramienta devolvió una respuesta inválida' }
    }

    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo ejecutar la herramienta',
    }
  }
}
