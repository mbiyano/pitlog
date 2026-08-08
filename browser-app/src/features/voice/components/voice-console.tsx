'use client'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Activity, Bug, Loader2, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { useVoiceSession } from '../hooks/use-voice-session'

export function VoiceConsole() {
  const {
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
  } = useVoiceSession()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Herramientas"
        title="Asistente de voz"
        description="Consultá información y registrá tareas sin dejar de trabajar. Las escrituras siempre requieren tu confirmación."
      />

      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/8 to-card">
          <CardContent className="flex flex-col items-center space-y-6 py-10 sm:py-14">
            <Badge
              variant={
                connectionState === 'connected'
                  ? 'success'
                  : connectionState === 'error'
                    ? 'destructive'
                    : connectionState === 'connecting'
                      ? 'warning'
                      : 'secondary'
              }
              className="gap-2 px-3 py-1"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionState === 'connected'
                    ? 'animate-pulse bg-success'
                    : connectionState === 'connecting'
                      ? 'animate-pulse bg-warning'
                      : connectionState === 'error'
                        ? 'bg-destructive-foreground'
                        : 'bg-muted-foreground'
                }`}
              />
              {connectionState === 'connected'
                ? 'Escuchando'
                : connectionState === 'connecting'
                  ? 'Conectando…'
                  : connectionState === 'error'
                    ? 'Conexión interrumpida'
                    : 'Listo para iniciar'}
            </Badge>

            {connectionState === 'disconnected' || connectionState === 'error' ? (
              <Button
                size="lg"
                className="h-28 w-28 flex-col gap-2 rounded-full shadow-xl shadow-primary/25"
                onClick={startSession}
                aria-label="Iniciar conversación de voz"
              >
                <Mic className="h-9 w-9" aria-hidden="true" />
                <span className="text-xs">Iniciar</span>
              </Button>
            ) : connectionState === 'connecting' ? (
              <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                </div>
                <Button variant="ghost" size="sm" onClick={stopSession}>Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Button
                  size="lg"
                  variant={isMuted ? 'destructive' : 'outline'}
                  className="h-16 w-16 rounded-full"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                  aria-pressed={isMuted}
                >
                  {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="h-16 w-16 rounded-full"
                  onClick={stopSession}
                  aria-label="Finalizar conversación"
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>
              </div>
            )}

            <div className="text-center">
              <p className="font-medium">
                {connectionState === 'connected'
                  ? isMuted ? 'Micrófono silenciado' : 'Podés hablar ahora'
                  : connectionState === 'connecting'
                    ? 'Estamos preparando el audio'
                    : 'Tocá el botón para comenzar'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                El asistente repetirá los datos sensibles y pedirá confirmación antes de guardar.
              </p>
            </div>

            {pendingTools > 0 && (
              <Badge variant="info" className="animate-pulse">
                Procesando {pendingTools} {pendingTools === 1 ? 'acción' : 'acciones'}…
              </Badge>
            )}

            {error && (
              <Alert variant="destructive" className="max-w-xl">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <audio ref={audioRef} autoPlay />
          </CardContent>
        </Card>

        {(transcript || assistantText) && (
          <Card aria-live="polite">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
                Conversación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {transcript && (
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground">
                  <p className="mb-1 text-xs font-semibold opacity-70">Vos</p>
                  <p className="text-sm leading-relaxed">{transcript}</p>
                </div>
              )}
              {assistantText && (
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm border bg-muted px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-primary">Asistente</p>
                  <p className="text-sm leading-relaxed">{assistantText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Última acción</p>
              <p className="truncate text-sm font-medium">{lastAction ?? 'Todavía no hay acciones'}</p>
            </div>
          </CardContent>
        </Card>

        <details className="rounded-xl border bg-card/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            <Bug className="h-4 w-4" aria-hidden="true" />
            Diagnóstico técnico
          </summary>
          <div className="border-t p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Eventos recientes de la sesión</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearEvents}
                disabled={events.length === 0}
              >
                Limpiar
              </Button>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
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
                        ? 'border-info/30 bg-info/5'
                        : evt.type.includes('tool.result')
                          ? 'border-success/30 bg-success/5'
                          : evt.type.includes('error')
                            ? 'border-destructive/30 bg-destructive/5'
                            : ''
                    }`}
                  >
                    <span className="text-muted-foreground">{evt.timestamp}</span>{' '}
                    <span className="font-bold">{evt.type}</span>
                    {evt.data !== undefined && (
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
          </div>
        </details>
      </div>
    </div>
  )
}
