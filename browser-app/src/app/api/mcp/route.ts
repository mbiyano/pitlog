import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeMcpMethod, isMcpMethod } from '@/features/voice/server/mcp-methods'

/** Server-to-server JSON-RPC endpoint used by the voice gateway. */

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? ''

const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string().min(1),
  params: z.record(z.unknown()).optional(),
  id: z.number(),
})

function jsonRpcError(id: number | null, message: string, status = 400) {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { message }, id },
    { status },
  )
}

export async function POST(request: NextRequest) {
  if (!MCP_AUTH_TOKEN && process.env.NODE_ENV === 'production') {
    return jsonRpcError(null, 'MCP_AUTH_TOKEN is not configured', 503)
  }

  if (MCP_AUTH_TOKEN && request.headers.get('authorization') !== `Bearer ${MCP_AUTH_TOKEN}`) {
    return jsonRpcError(null, 'Unauthorized', 401)
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return jsonRpcError(null, 'Invalid JSON')
  }

  const parsed = jsonRpcRequestSchema.safeParse(rawBody)
  if (!parsed.success) return jsonRpcError(null, 'Invalid JSON-RPC request')

  const { method, params, id } = parsed.data
  if (!method || !isMcpMethod(method)) {
    return jsonRpcError(id ?? null, `Unknown method: ${method ?? ''}`)
  }

  try {
    const result = await executeMcpMethod(method, params)
    return NextResponse.json({ jsonrpc: '2.0', result, id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    return jsonRpcError(id, message, 500)
  }
}
