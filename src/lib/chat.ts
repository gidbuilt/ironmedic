import { supabase } from './supabase'
import type { Diagnosis, DiagnosticStage, DifferentialEntry, Machine, Repair } from '../types/database'

export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'status'; status: 'searching_web' }
  | {
      type: 'done'
      stage: DiagnosticStage | null
      diagnosis: Diagnosis | null
      repair: Repair | null
      /** Present when Gus just auto-identified a quick-chat machine's make/model. */
      machine?: Machine | null
      /** Gus's live, continuously-updated ranked differential for this turn. */
      differential?: DifferentialEntry[] | null
    }
  | { type: 'error'; message: string }

export interface StreamChatParams {
  machineId: string
  message: string
  photoPaths?: string[]
  onEvent: (event: ChatStreamEvent) => void
  signal?: AbortSignal
}

/**
 * Calls the gus-chat Edge Function directly with fetch (rather than
 * supabase.functions.invoke) so we can consume the response as a live SSE
 * stream instead of waiting for the full body.
 */
export async function streamChat({ machineId, message, photoPaths = [], onEvent, signal }: StreamChatParams): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Not signed in.')

  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gus-chat`

  const response = await fetch(functionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ machine_id: machineId, message, photo_paths: photoPaths }),
    signal,
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body.message || body.error || ''
    } catch {
      // ignore
    }
    const err = new Error(detail || `Request failed (${response.status})`) as Error & { status?: number }
    err.status = response.status
    throw err
  }

  if (!response.body) throw new Error('No response stream from server.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'))
      if (!dataLine) continue
      const jsonStr = dataLine.slice(5).trim()
      if (!jsonStr) continue
      try {
        onEvent(JSON.parse(jsonStr) as ChatStreamEvent)
      } catch {
        // ignore malformed chunk
      }
    }
  }
}
