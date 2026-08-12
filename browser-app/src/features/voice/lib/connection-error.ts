export type VoiceConnectionErrorCode =
  | 'microphone_denied'
  | 'microphone_missing'
  | 'microphone_unavailable'
  | 'gateway_unavailable'
  | 'realtime_unavailable'
  | 'connection_failed'

export interface VoiceConnectionError {
  code: VoiceConnectionErrorCode
  message: string
}

function errorName(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('name' in error)) return ''
  return String(error.name)
}

function errorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('message' in error)) return ''
  return String(error.message)
}

export function isConnectionCancellation(error: unknown): boolean {
  return errorName(error) === 'AbortError'
}

export function getVoiceConnectionError(error: unknown): VoiceConnectionError {
  const name = errorName(error)
  const message = errorMessage(error)

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      code: 'microphone_denied',
      message: 'Necesitamos permiso para usar el micrófono. Habilitalo y volvé a intentarlo.',
    }
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'microphone_missing',
      message: 'No encontramos un micrófono disponible en este dispositivo.',
    }
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'microphone_unavailable',
      message: 'No pudimos usar el micrófono. Verificá que otra aplicación no lo esté ocupando.',
    }
  }

  if (message.startsWith('Gateway token error')) {
    return {
      code: 'gateway_unavailable',
      message: 'El asistente no está disponible en este momento. Volvé a intentarlo en unos segundos.',
    }
  }

  if (message.startsWith('OpenAI SDP error')) {
    return {
      code: 'realtime_unavailable',
      message: 'No pudimos establecer la conexión de voz. Volvé a intentarlo.',
    }
  }

  return {
    code: 'connection_failed',
    message: 'No pudimos conectar con el asistente. Volvé a intentarlo.',
  }
}
