'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { executeToolCall } from '../api/execute-tool-call'
import { VOICE_GATEWAY_URL, WRITE_TOOLS } from '../config'
import {
  hasExplicitWriteConfirmation,
  isPlateConfirmationPrompt,
  isWriteConfirmationPrompt,
} from '../lib/confirmation'
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
  const eventIdRef = useRef(0)
  const lastUserTranscriptRef = useRef('')
  const lastAssistantTranscriptRef = useRef('')
  const confirmedPlatesRef = useRef(new Set<string>())
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

          const hasConfirmation =
            hasExplicitWriteConfirmation(lastUserTranscriptRef.current) &&
            isWriteConfirmationPrompt(lastAssistantTranscriptRef.current)
          const normalizedPlate =
            typeof args.patente === 'string'
              ? args.patente.toUpperCase().replace(/\s/g, '')
              : null
          const hasPlateReadBackConfirmation =
            hasExplicitWriteConfirmation(lastUserTranscriptRef.current) &&
            isPlateConfirmationPrompt(lastAssistantTranscriptRef.current)

          let result
          if (name === 'buscar_auto_por_patente' && !hasPlateReadBackConfirmation) {
            result = {
              success: false,
              error:
                'PATENTE_NO_CONFIRMADA: repetí la patente separando letras y números, preguntá si es correcta y esperá la respuesta antes de buscar.',
            }
          } else if (
            name === 'crear_auto' &&
            (!normalizedPlate || !confirmedPlatesRef.current.has(normalizedPlate))
          ) {
            result = {
              success: false,
              error:
                'PATENTE_NO_CONFIRMADA: no se puede crear el vehículo hasta confirmar la patente letra por letra y buscarla.',
            }
          } else if (
            name === 'crear_auto' &&
            normalizedPlate &&
            (plateMissesRef.current.get(normalizedPlate) ?? 0) < 2
          ) {
            result = {
              success: false,
              error:
                'SEGUNDA_BUSQUEDA_REQUERIDA: repetí y confirmá nuevamente la patente, y volvé a buscarla antes de ofrecer crear el vehículo.',
            }
          } else if (isWrite && !hasConfirmation) {
            result = {
              success: false,
              error:
                'CONFIRMACION_REQUERIDA: resumí la escritura y preguntá "¿Confirmás que guarde estos datos?". La confirmación de una patente o nombre no autoriza a guardar.',
            }
          } else {
            result = await executeToolCall(name, args)
          }

          if (name === 'buscar_auto_por_patente' && result.success && normalizedPlate) {
            confirmedPlatesRef.current.add(normalizedPlate)
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

          if (isWrite && result.success) {
            lastUserTranscriptRef.current = ''
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
          lastUserTranscriptRef.current = event.transcript as string
          setTranscript(lastUserTranscriptRef.current)
          addEvent('rt.transcript.user', { text: lastUserTranscriptRef.current.slice(0, 80) })
          break

        case 'response.output_audio_transcript.done':
          lastAssistantTranscriptRef.current = event.transcript as string
          setAssistantText(lastAssistantTranscriptRef.current)
          addEvent('rt.transcript.assistant', { text: lastAssistantTranscriptRef.current?.slice(0, 80) })
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
      // Start the two independent network/device waits together. Requesting the
      // Realtime token no longer waits for microphone permission and SDP setup.
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
      const microphonePromise = navigator.mediaDevices.getUserMedia({ audio: true })

      const [stream, tokenData] = await Promise.all([microphonePromise, tokenPromise])
      streamRef.current = stream
      addEvent('mic.acquired')
      addEvent('token.received', { sessionId: tokenData.sessionId })

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

      // Wait only for the first usable ICE candidate (or completion), instead
      // of delaying every connection for a full ICE-gathering cycle.
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve()
          return
        }
        const timeout = setTimeout(() => {
          addEvent('ice.timeout', { state: pc.iceGatheringState })
          pc.removeEventListener('icecandidate', handleCandidate)
          resolve()
        }, 300)
        const handleCandidate = (event: RTCPeerConnectionIceEvent) => {
          if (event.candidate || pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            pc.removeEventListener('icecandidate', handleCandidate)
            resolve()
          }
        }
        pc.addEventListener('icecandidate', handleCandidate)
      })

      // ── Send SDP directly to OpenAI using the ephemeral token ───────────
      addEvent('sdp.offer.sending', { direct: true })
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
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
    lastUserTranscriptRef.current = ''
    lastAssistantTranscriptRef.current = ''
    confirmedPlatesRef.current.clear()
    plateMissesRef.current.clear()
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
