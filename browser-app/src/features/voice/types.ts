export interface VoiceEvent {
  id: number
  timestamp: string
  type: string
  data?: unknown
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ToolCallResult {
  success: boolean
  result?: unknown
  error?: string
}

export interface VoiceAction {
  toolName: string
  status: 'processing' | 'success' | 'error'
}
