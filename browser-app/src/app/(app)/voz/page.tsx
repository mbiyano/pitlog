'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Phone, PhoneOff, Volume2, Activity } from 'lucide-react'

const VOICE_GATEWAY_URL = process.env.NEXT_PUBLIC_VOICE_GATEWAY_URL ?? 'http://localhost:8080'

// ── Tool call handling ──────────────────────────────────────────────────────────

/** Known write tools that the model should only call after verbal confirmation. */
const WRITE_TOOLS = new Set([
  'crear_auto',
  'actualizar_auto',
  'crear_cliente',
  'crear_visita_taller',
  'agregar_trabajo_a_visita',
  'actualizar_trabajo',
  'crear_recordatorio_service',
])

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const res = await fetch('/api/voice/tool-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: name, params: args }),
    })
    return await res.json()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface VoiceEvent {
  id: number
  timestamp: string
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoicePage() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [assistantText, setAssistantText] = useState('')
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [events, setEvents] = useState<VoiceEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingTools, setPendingTools] = useState(0)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const eventIdRef = useRef(0)

  const addEvent = useCallback((type: string, data?: unknown) => {
    const id = ++eventIdRef.current
    setEvents((prev) => [
      { id, timestamp: new Date().toISOString().split('T')[1].slice(0, 12), type, data },
      ...prev.slice(0, 149),
    ])
  }, [])

  // ── Send a message on the OpenAI data channel ────────────────────────────────

  const sendOnDataChannel = useCallback(
    (msg: unknown) => {
      const dc = dcRef.current
      if (!dc || dc.readyState !== 'open') {
        addEvent('dc.send.failed', { readyState: dc?.readyState })
        return
      }
      dc.send(JSON.stringify(msg))
    },
    [addEvent],
  )

  // ── Handle incoming Realtime events from OpenAI data channel ─────────────────

  const handleRealtimeEvent = useCallback(
    async (event: Record<string, unknown>) => {
      const eventType = event.type as string

      switch (eventType) {
        case 'session.created':
          addEvent('rt.session.created', { session_id: (event.session as { id: string })?.id })
          break

        case 'session.updated':
          addEvent('rt.session.updated')
          break

        case 'response.function_call_arguments.done': {
          // ── Tool call from the model ──────────────────────────────────────
          const name = event.name as string
          const callId = event.call_id as string
          const rawArgs = event.arguments as string

          let args: Record<string, unknown>
          try {
            args = JSON.parse(rawArgs)
          } catch {
            addEvent('rt.tool.parse_error', { name, rawArgs })
            sendOnDataChannel({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({ error: 'Argumentos inválidos' }),
              },
            })
            sendOnDataChannel({ type: 'response.create', response: { modalities: ['audio', 'text'] } })
            break
          }

          const isWrite = WRITE_TOOLS.has(name)
          addEvent(`rt.tool.call`, { name, args, isWrite })
          setPendingTools((n) => n + 1)
          setLastAction(`${isWrite ? '✏️' : '🔍'} ${name}`)

          // Execute the tool via our API proxy
          const result = await executeToolCall(name, args)

          setPendingTools((n) => Math.max(0, n - 1))
          addEvent(`rt.tool.result`, { name, success: result.success, result: result.result, error: result.error })

          if (isWrite && result.success) {
            setLastAction(`✅ ${name}`)
          } else if (!result.success) {
            setLastAction(`❌ ${name}`)
          }

          // Build the output sent to the model.
          // When there's an error, make it impossible for the model to misinterpret as success.
          let toolOutput: string
          if (result.success) {
            toolOutput = JSON.stringify(result.result)
          } else {
            toolOutput = JSON.stringify({
              status: 'OPERACION_FALLIDA',
              error: result.error ?? 'Error desconocido',
              instruccion: `La herramienta "${name}" falló. Avisale al mecánico que hubo un error: ${result.error}. NO digas que se guardó.`,
            })
          }

          // Send function output back to OpenAI
          sendOnDataChannel({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: toolOutput,
            },
          })

          // Trigger the model to generate the next response
          sendOnDataChannel({ type: 'response.create', response: { modalities: ['audio', 'text'] } })
          break
        }

        case 'conversation.item.input_audio_transcription.completed':
          setTranscript(event.transcript as string)
          addEvent('rt.transcript.user', { text: (event.transcript as string)?.slice(0, 80) })
          break

        case 'response.audio_transcript.done':
          setAssistantText(event.transcript as string)
          addEvent('rt.transcript.assistant', { text: (event.transcript as string)?.slice(0, 80) })
          break

        case 'error':
          addEvent('rt.error', event.error)
          break

        default:
          // Log less-common events at debug level
          if (
            eventType.startsWith('response.') ||
            eventType.startsWith('conversation.') ||
            eventType.startsWith('input_audio_buffer.')
          ) {
            // skip noisy events
          } else {
            addEvent('rt.event', { type: eventType })
          }
          break
      }
    },
    [addEvent, sendOnDataChannel],
  )

  // ── Start voice session ──────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    setConnectionState('connecting')
    setError(null)
    setTranscript('')
    setAssistantText('')
    setLastAction(null)
    addEvent('session.start', { gateway: VOICE_GATEWAY_URL })

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      addEvent('mic.acquired')

      // Create peer connection — no iceServers needed, OpenAI handles connectivity
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // Add audio track
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Handle remote audio
      pc.ontrack = (event) => {
        addEvent('track.received', { kind: event.track.kind })
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0]
        }
      }

      pc.oniceconnectionstatechange = () => {
        addEvent('ice.state', { state: pc.iceConnectionState })
        if (pc.iceConnectionState === 'connected') {
          setConnectionState('connected')
        } else if (
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'disconnected'
        ) {
          setConnectionState('error')
          setError('La conexión WebRTC se perdió')
        }
      }

      // ── Create the data channel for OpenAI Realtime events ────────────────
      // The CLIENT must create this channel before the SDP offer.
      // OpenAI sends tool calls, transcripts, and session events on it.
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.onopen = () => {
        addEvent('dc.opened', { label: dc.label })
      }

      dc.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data)
          void handleRealtimeEvent(parsed)
        } catch {
          addEvent('dc.raw', { data: typeof msg.data === 'string' ? msg.data.slice(0, 200) : '(binary)' })
        }
      }

      dc.onclose = () => {
        addEvent('dc.closed', { label: dc.label })
        dcRef.current = null
      }

      // Also handle any server-created data channels (fallback)
      pc.ondatachannel = (event) => {
        const serverDc = event.channel
        addEvent('dc.server', { label: serverDc.label })
        // If OpenAI creates its own channel, use it too
        if (!dcRef.current || dcRef.current.readyState !== 'open') {
          dcRef.current = serverDc
        }
        serverDc.onmessage = (msg) => {
          try {
            const parsed = JSON.parse(msg.data)
            void handleRealtimeEvent(parsed)
          } catch {
            addEvent('dc.raw', { data: typeof msg.data === 'string' ? msg.data.slice(0, 200) : '(binary)' })
          }
        }
      }

      // Create SDP offer and start ICE gathering
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      addEvent('sdp.offer.created')

      // ── Parallel: gather ICE candidates + request ephemeral token ────────
      // ICE gathering with a hard timeout — host candidates are usually
      // available instantly; we don't need to wait for srflx/relay.
      const iceReady = new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve()
          return
        }
        const timeout = setTimeout(() => {
          addEvent('ice.timeout', { state: pc.iceGatheringState })
          resolve()
        }, 2000)
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve()
          }
        }
      })

      addEvent('token.requesting')
      const tokenPromise = fetch(`${VOICE_GATEWAY_URL}/api/realtime/token`, {
        method: 'POST',
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Gateway token error ${res.status}: ${text}`)
        }
        return res.json() as Promise<{ sessionId: string; token: string; model: string }>
      })

      // Wait for both in parallel
      const [, tokenData] = await Promise.all([iceReady, tokenPromise])
      addEvent('token.received', { sessionId: tokenData.sessionId })

      // ── Send SDP directly to OpenAI using the ephemeral token ───────────
      addEvent('sdp.offer.sending', { direct: true })
      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(tokenData.model)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            'Content-Type': 'application/sdp',
          },
          body: pc.localDescription!.sdp,
        },
      )

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text()
        throw new Error(`OpenAI SDP error ${sdpResponse.status}: ${text}`)
      }

      const answerSdp = await sdpResponse.text()
      addEvent('sdp.answer.received')

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      addEvent('session.established')
      setConnectionState('connected')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      setConnectionState('error')
      addEvent('error', { message })
      stopSession()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addEvent, handleRealtimeEvent])

  const stopSession = useCallback(() => {
    dcRef.current = null
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null
    }
    setConnectionState('disconnected')
    setTranscript('')
    setAssistantText('')
    setLastAction(null)
    setPendingTools(0)
    addEvent('session.stopped')
  }, [addEvent])

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
        addEvent('mic.toggle', { muted: !audioTrack.enabled })
      }
    }
  }, [addEvent])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) pcRef.current.close()
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asistente de Voz"
        description="Hablá con el asistente para registrar autos, clientes y visitas"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main control */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col items-center space-y-6 py-12">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    connectionState === 'connected'
                      ? 'animate-pulse bg-green-500'
                      : connectionState === 'connecting'
                        ? 'animate-pulse bg-yellow-500'
                        : connectionState === 'error'
                          ? 'bg-red-500'
                          : 'bg-muted-foreground'
                  }`}
                />
                <span className="text-sm font-medium">
                  {connectionState === 'connected'
                    ? 'Conectado'
                    : connectionState === 'connecting'
                      ? 'Conectando...'
                      : connectionState === 'error'
                        ? 'Error'
                        : 'Desconectado'}
                </span>
                {pendingTools > 0 && (
                  <Badge variant="secondary" className="ml-2 animate-pulse">
                    Procesando {pendingTools} {pendingTools === 1 ? 'acción' : 'acciones'}...
                  </Badge>
                )}
              </div>

              {/* Big action button */}
              {connectionState === 'disconnected' || connectionState === 'error' ? (
                <Button
                  size="lg"
                  className="h-24 w-24 rounded-full text-lg"
                  onClick={startSession}
                >
                  <Phone className="h-10 w-10" />
                </Button>
              ) : (
                <div className="flex items-center gap-4">
                  <Button
                    size="lg"
                    variant={isMuted ? 'destructive' : 'outline'}
                    className="h-16 w-16 rounded-full"
                    onClick={toggleMute}
                  >
                    {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="h-16 w-16 rounded-full"
                    onClick={stopSession}
                  >
                    <PhoneOff className="h-7 w-7" />
                  </Button>
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground">
                {connectionState === 'disconnected'
                  ? 'Presioná para iniciar una sesión de voz'
                  : connectionState === 'connected'
                    ? 'Hablá con el asistente — escucha y responde por audio'
                    : connectionState === 'connecting'
                      ? 'Estableciendo conexión...'
                      : 'Intentá nuevamente'}
              </p>

              {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <audio ref={audioRef} autoPlay />
            </CardContent>
          </Card>

          {/* Transcripts */}
          {(transcript || assistantText) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Volume2 className="h-4 w-4" />
                  Conversación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {transcript && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Vos</p>
                    <p className="text-sm">{transcript}</p>
                  </div>
                )}
                {assistantText && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Asistente</p>
                    <p className="text-sm">{assistantText}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Session state */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Estado de sesión
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Última acción</p>
                  <p className="mt-1 text-sm font-medium">{lastAction ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conexión</p>
                  <Badge
                    variant={
                      connectionState === 'connected'
                        ? 'success'
                        : connectionState === 'error'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {connectionState}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debug event panel */}
        <Card className="lg:row-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Eventos</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEvents([])}
                disabled={events.length === 0}
              >
                Limpiar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] space-y-1 overflow-y-auto">
              {events.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Sin eventos
                </p>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    className={`rounded border px-2 py-1.5 font-mono text-xs ${
                      evt.type.includes('tool.call')
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : evt.type.includes('tool.result')
                          ? 'border-green-500/30 bg-green-500/5'
                          : evt.type.includes('error')
                            ? 'border-red-500/30 bg-red-500/5'
                            : ''
                    }`}
                  >
                    <span className="text-muted-foreground">{evt.timestamp}</span>{' '}
                    <span className="font-bold">{evt.type}</span>
                    {evt.data && (
                      <pre className="mt-0.5 overflow-hidden text-ellipsis whitespace-pre-wrap text-muted-foreground">
                        {typeof evt.data === 'string'
                          ? evt.data
                          : JSON.stringify(evt.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
