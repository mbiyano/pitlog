import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { executeMcpMethod, isMcpMethod } from '@/features/voice/server/mcp-methods'

const toolCallRequestSchema = z.object({
  method: z.string().min(1),
  params: z.record(z.unknown()).optional(),
})

/**
 * Same-origin endpoint used by the authenticated voice UI. It invokes the
 * shared MCP application service directly, avoiding a second HTTP hop and
 * keeping the server-to-server MCP token out of the browser flow.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = toolCallRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid tool call' }, { status: 400 })
  }

  const body = parsed.data

  if (!body.method || !isMcpMethod(body.method)) {
    return NextResponse.json(
      { success: false, error: `Unknown method: ${body.method ?? ''}` },
      { status: 400 },
    )
  }

  try {
    const result = await executeMcpMethod(body.method, body.params)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
