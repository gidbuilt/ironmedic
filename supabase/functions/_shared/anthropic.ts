// Thin wrapper around the Anthropic Messages API using raw fetch + SSE
// parsing — deliberately no SDK dependency, to keep this Edge Function's
// behavior fully transparent and easy to debug from the raw wire format.

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-opus-4-8'
const WEB_SEARCH_TOOL_TYPE = 'web_search_20250305'

export async function callClaudeStream(params: {
  system: string
  messages: ClaudeMessage[]
  maxTokens?: number
  enableWebSearch?: boolean
  model?: string
}): Promise<Response> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on this Edge Function')

  const model = params.model ?? Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL

  const body: Record<string, unknown> = {
    model,
    // 1024 was tight enough that STAGE:diagnosis turns could get cut off
    // before finishing the required diagnosis-json block (which now also
    // carries repair_steps/verification_steps) — 2048 gives room for the
    // full write-up + structured block without changing normal-turn length,
    // since the model still stops on its own well under this ceiling.
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
    messages: params.messages,
    stream: true,
  }

  if (params.enableWebSearch) {
    body.tools = [{ type: WEB_SEARCH_TOOL_TYPE, name: 'web_search', max_uses: 3 }]
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Anthropic API error ${response.status}: ${errText}`)
  }

  return response
}

interface AnthropicSseEvent {
  type: string
  index?: number
  content_block?: {
    type: string
    name?: string
    text?: string
    content?: Array<{ url?: string }>
  }
  delta?: {
    type?: string
    text?: string
    stop_reason?: string
  }
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'status'; status: 'searching_web' }
  | { type: 'final'; fullText: string; sourceUrls: string[]; webSearchUsed: boolean; stopReason: string | null }

/**
 * Parses Anthropic's SSE stream into a simplified sequence of events,
 * accumulating the full assistant text (across any text blocks interleaved
 * with server-tool blocks like web_search) and any source URLs surfaced by
 * a web_search_tool_result block, so the caller can cache them.
 */
export async function* parseAnthropicStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const sourceUrls: string[] = []
  let webSearchUsed = false
  let stopReason: string | null = null

  // Tracks content_block index -> type, so deltas know what they belong to.
  const blockTypes = new Map<number, string>()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const rawEvent of events) {
        const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data:'))
        if (!dataLine) continue
        const jsonStr = dataLine.slice(5).trim()
        if (!jsonStr || jsonStr === '[DONE]') continue

        let payload: AnthropicSseEvent
        try {
          payload = JSON.parse(jsonStr) as AnthropicSseEvent
        } catch {
          continue
        }

        switch (payload.type) {
          case 'content_block_start': {
            const blockType = payload.content_block?.type
            if (payload.index != null && blockType) blockTypes.set(payload.index, blockType)
            if (blockType === 'server_tool_use' && payload.content_block?.name === 'web_search') {
              webSearchUsed = true
              yield { type: 'status', status: 'searching_web' }
            }
            if (blockType === 'web_search_tool_result') {
              const results = payload.content_block?.content
              if (Array.isArray(results)) {
                for (const r of results) {
                  if (r?.url) sourceUrls.push(r.url)
                }
              }
            }
            if (blockType === 'text' && payload.content_block?.text) {
              fullText += payload.content_block.text
              yield { type: 'text', text: payload.content_block.text }
            }
            break
          }
          case 'content_block_delta': {
            const blockType = payload.index != null ? blockTypes.get(payload.index) : undefined
            if (payload.delta?.type === 'text_delta' && blockType === 'text' && payload.delta.text) {
              fullText += payload.delta.text
              yield { type: 'text', text: payload.delta.text }
            }
            break
          }
          case 'message_delta': {
            if (payload.delta?.stop_reason) stopReason = payload.delta.stop_reason
            break
          }
          default:
            break
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: 'final', fullText, sourceUrls, webSearchUsed, stopReason }
}
