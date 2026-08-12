'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { executeToolCall } from '../api/execute-tool-call'
import { VOICE_GATEWAY_URL, WRITE_TOOLS } from '../config'
import { getVoiceConnectionError, isConnectionCancellation } from '../lib/connection-error'
import type { ConnectionState, VoiceAction, VoiceEvent } from '../types'

// ── Component ─────────────────────────────────────────────────────────────────

export function useVoiceSession() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [assistantText, setAssistantText] = useState('')
  const [lastAction, setLastAction] = useState<VoiceAction | null>(null)
  const [events, setEvents] = useState<VoiceEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingTools, setPendingTools] = useState(0)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const connectionAbortRef = useRef<AbortController | null>(null)
  const connectionAttemptRef = useRef(0)
  const eventIdRef = useRef(0)
  const plateMissesRef = useRef(new Map<string, number>())

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
            sendOnDataChannel({ type: 'response.create' })
            break
          }

          const isWrite = WRITE_TOOLS.has(name)
          addEvent(`rt.tool.call`, { name, args, isWrite })
          setPendingTools((n) => n + 1)
          setLastAction({ toolName: name, status: 'processing' })

          const normalizedPlate =
            typeof args.patente === 'string'
              ? args.patente.toUpperCase().replace(/\s/g, '')
              : null

          let result
          if (name === 'crear_auto' && !normalizedPlate) {
            result = {
              success: false,
              error: 'PATENTE_REQUERIDA: no se puede crear el vehículo sin una patente válida.',
            }
          } else if (
            name === 'crear_auto' &&
            normalizedPlate &&
            (plateMissesRef.current.get(normalizedPlate) ?? 0) < 2
          ) {
            result = {
              success: false,
              error:
                'SEGUNDA_BUSQUEDA_REQUERIDA: buscá nuevamente la misma patente sin pedir otra confirmación antes de crear el vehículo.',
            }
          } else {
            result = await executeToolCall(name, args)
          }

          if (name === 'buscar_auto_por_patente' && result.success && normalizedPlate) {
            plateMissesRef.current.set(
              normalizedPlate,
              result.result === null ? (plateMissesRef.current.get(normalizedPlate) ?? 0) + 1 : 0,
            )
          }

          if (isWrite && result.success) {
            const persisted = result.result as
              | { id?: unknown; persistenciaVerificada?: unknown }
              | null
              | undefined
            if (
              !persisted ||
              typeof persisted.id !== 'string' ||
              persisted.persistenciaVerificada !== true
            ) {
              result = {
                success: false,
                error: `No se pudo verificar en la base que la herramienta "${name}" haya guardado el registro.`,
              }
            }
          }

          setPendingTools((n) => Math.max(0, n - 1))
          addEvent(`rt.tool.result`, { name, success: result.success, result: result.result, error: result.error })

          setLastAction({
            toolName: name,
            status: result.success ? 'success' : 'error',
          })

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
          sendOnDataChannel({ type: 'response.create' })
          break
        }

        case 'conversation.item.input_audio_transcription.completed':
          setTranscript(event.transcript as string)
          addEvent('rt.transcript.user', { text: (event.transcript as string).slice(0, 80) })
          break

        case 'response.output_audio_transcript.done':
          setAssistantText(event.transcript as string)
          addEvent('rt.transcript.assistant', { text: (event.transcript as string)?.slice(0, 80) })
          break

        case 'error':
          addEvent('rt.error', { code: 'realtime_event_error' })
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

  const releaseSessionResources = useCallback(() => {
    dcRef.current = null

    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null
    }
  }, [])

  const stopSession = useCallback(() => {
    connectionAttemptRef.current += 1
    connectionAbortRef.current?.abort()
    connectionAbortRef.current = null
    releaseSessionResources()

    setConnectionState('disconnected')
    setIsMuted(false)
    setTranscript('')
    setAssistantText('')
    setLastAction(null)
    setPendingTools(0)
    setError(null)
    plateMissesRef.current.clear()
    addEvent('session.stopped')
  }, [addEvent, releaseSessionResources])

  // ── Start voice session ──────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    connectionAbortRef.current?.abort()
    releaseSessionResources()

    const attemptId = connectionAttemptRef.current + 1
    connectionAttemptRef.current = attemptId
    const abortController = new AbortController()
    connectionAbortRef.current = abortController

    const isAttemptActive = () =>
      connectionAttemptRef.current === attemptId && !abortController.signal.aborted
    const ensureAttemptActive = () => {
      if (!isAttemptActive()) {
        throw new DOMException('Voice connection cancelled', 'AbortError')
      }
    }

    setConnectionState('connecting')
    setIsMuted(false)
    setError(null)
    setTranscript('')
    setAssistantText('')
    setLastAction(null)
    setPendingTools(0)
    plateMissesRef.current.clear()
    addEvent('session.start', { gateway: VOICE_GATEWAY_URL })

    try {
      // Start the two independent network/device waits together. Requesting the
      // Realtime token no longer waits for microphone permission and SDP setup.
      addEvent('token.requesting')
      const tokenPromise = fetch(`${VOICE_GATEWAY_URL}/api/realtime/token`, {
        method: 'POST',
        signal: abortController.signal,
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Gateway token error ${res.status}: ${text}`)
        }
        return res.json() as Promise<{ sessionId: string; token: string; model: string }>
      })
      const microphonePromise = navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        if (!isAttemptActive()) {
          stream.getTracks().forEach((track) => track.stop())
          throw new DOMException('Voice connection cancelled', 'AbortError')
        }
        return stream
      })

      const [stream, tokenData] = await Promise.all([microphonePromise, tokenPromise])
      ensureAttemptActive()
      streamRef.current = stream
      addEvent('mic.acquired')
      addEvent('token.received', { sessionId: tokenData.sessionId })

      // Create peer connection — no iceServers needed, OpenAI handles connectivity
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      ensureAttemptActive()

      // Add audio track
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Handle remote audio
      pc.ontrack = (event) => {
        if (!isAttemptActive()) return
        addEvent('track.received', { kind: event.track.kind })
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0]
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (!isAttemptActive()) return
        addEvent('ice.state', { state: pc.iceConnectionState })
        if (pc.iceConnectionState === 'connected') {
          setConnectionState('connected')
        } else if (
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'disconnected'
        ) {
          setConnectionState('error')
          setError('Se perdió la conexión con el asistente. Podés volver a intentarlo.')
        }
      }

      // ── Create the data channel for OpenAI Realtime events ────────────────
      // The CLIENT must create this channel before the SDP offer.
      // OpenAI sends tool calls, transcripts, and session events on it.
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.onopen = () => {
        if (!isAttemptActive()) return
        addEvent('dc.opened', { label: dc.label })
      }

      dc.onmessage = (msg) => {
        if (!isAttemptActive()) return
        try {
          const parsed = JSON.parse(msg.data)
          void handleRealtimeEvent(parsed)
        } catch {
          addEvent('dc.raw', { data: typeof msg.data === 'string' ? msg.data.slice(0, 200) : '(binary)' })
        }
      }

      dc.onclose = () => {
        if (!isAttemptActive()) return
        addEvent('dc.closed', { label: dc.label })
        dcRef.current = null
      }

      // Also handle any server-created data channels (fallback)
      pc.ondatachannel = (event) => {
        if (!isAttemptActive()) return
        const serverDc = event.channel
        addEvent('dc.server', { label: serverDc.label })
        // If OpenAI creates its own channel, use it too
        if (!dcRef.current || dcRef.current.readyState !== 'open') {
          dcRef.current = serverDc
        }
        serverDc.onmessage = (msg) => {
          if (!isAttemptActive()) return
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
      ensureAttemptActive()
      await pc.setLocalDescription(offer)
      ensureAttemptActive()
      addEvent('sdp.offer.created')

      // Wait only for the first usable ICE candidate (or completion), instead
      // of delaying every connection for a full ICE-gathering cycle.
      if (pc.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve) => {
          let settled = false

          const finish = () => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            pc.removeEventListener('icecandidate', handleCandidate)
            abortController.signal.removeEventListener('abort', finish)
            resolve()
          }
          const handleCandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate || pc.iceGatheringState === 'complete') finish()
          }

          const timeout = setTimeout(() => {
            if (isAttemptActive()) addEvent('ice.timeout', { state: pc.iceGatheringState })
            finish()
          }, 300)
          pc.addEventListener('icecandidate', handleCandidate)
          abortController.signal.addEventListener('abort', finish, { once: true })
        })
      }
      ensureAttemptActive()

      // ── Send SDP directly to OpenAI using the ephemeral token ───────────
      addEvent('sdp.offer.sending', { direct: true })
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          Authorization: `Bearer ${tokenData.token}`,
          'Content-Type': 'application/sdp',
        },
        body: pc.localDescription!.sdp,
      })

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text()
        throw new Error(`OpenAI SDP error ${sdpResponse.status}: ${text}`)
      }

      const answerSdp = await sdpResponse.text()
      ensureAttemptActive()
      addEvent('sdp.answer.received')

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      ensureAttemptActive()

      addEvent('session.established')
      setConnectionState('connected')
    } catch (err) {
      if (!isAttemptActive() || isConnectionCancellation(err)) return

      abortController.abort()
      releaseSessionResources()
      const failure = getVoiceConnectionError(err)
      setError(failure.message)
      setConnectionState('error')
      addEvent('session.error', { code: failure.code })
    } finally {
      if (connectionAbortRef.current === abortController) {
        connectionAbortRef.current = null
      }
    }
  }, [addEvent, handleRealtimeEvent, releaseSessionResources])

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
      connectionAttemptRef.current += 1
      connectionAbortRef.current?.abort()
      connectionAbortRef.current = null
      releaseSessionResources()
    }
  }, [releaseSessionResources])

  const clearEvents = useCallback(() => setEvents([]), [])

  return {
    connectionState,
    isMuted,
    transcript,
    assistantText,
    lastAction,
    events,
    error,
    pendingTools,
    audioRef,
    startSession,
    stopSession,
    toggleMute,
    clearEvents,
  }
}
