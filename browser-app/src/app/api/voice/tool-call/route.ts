import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/voice/tool-call
 *
 * Browser-side proxy for voice tool calls. The browser's WebRTC data channel
 * receives tool calls from OpenAI and forwards them here. We then call the
 * internal MCP endpoint (same process) with the server-side auth token.
 *
 * This avoids exposing MCP_AUTH_TOKEN to the browser.
 */

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function toolLog(method: string, message: string, extra?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  console.log(JSON.stringify({ ts, layer: 'tool-call-proxy', method, message, ...extra }))
}

export async function POST(request: NextRequest) {
  let body: { method: string; params: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { method, params } = body
  if (!method) {
    return NextResponse.json({ success: false, error: 'Missing method' }, { status: 400 })
  }

  toolLog(method, 'Received tool call from browser', { params })

  try {
    const res = await fetch(`${APP_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MCP_AUTH_TOKEN}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {}, id: Date.now() }),
    })

    const data = await res.json()

    if (data.error) {
      toolLog(method, 'MCP returned error', { error: data.error, status: res.status })
      return NextResponse.json(
        { success: false, error: data.error.message ?? 'MCP error' },
        { status: res.status >= 400 ? res.status : 400 },
      )
    }

    toolLog(method, 'MCP success', { resultId: (data.result as { id?: string })?.id })
    return NextResponse.json({ success: true, result: data.result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    toolLog(method, 'Fetch to MCP failed', { error: message })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
