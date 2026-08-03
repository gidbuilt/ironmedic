import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient, getAuthedUser } from '../_shared/supabaseClients.ts'
import {
  cacheCommonIssues,
  countRuledOutInOpenCase,
  getCachedCommonIssues,
  getMachineHistory,
  getPendingDiagnosis,
  lookupSpnFmi,
  matchCasePrecedents,
  matchManualExcerpts,
} from '../_shared/knowledge.ts'
import { buildSystemPrompt } from '../_shared/prompt.ts'
import { callClaudeStream, parseAnthropicStream, type ClaudeContentBlock, type ClaudeMessage } from '../_shared/anthropic.ts'
import { parseModelResponse } from '../_shared/parseResponse.ts'
import { ResponseStreamFilter } from '../_shared/streamFilter.ts'

const FREE_DIAGNOSIS_LIMIT = Number(Deno.env.get('FREE_DIAGNOSIS_LIMIT') ?? '3')
/** On by default; set ENFORCE_FREE_TIER=false to disable the paywall while testing. */
const ENFORCE_FREE_TIER = Deno.env.get('ENFORCE_FREE_TIER') !== 'false'

interface ChatRequestBody {
  machine_id: string
  message: string
  photo_paths?: string[]
}

function symptomKeywordsFor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8)
    .sort()
    .join(' ')
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function sse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const userClient = createUserClient(authHeader)
  const user = await getAuthedUser(userClient)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  let body: ChatRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const { machine_id, message, photo_paths = [] } = body
  if (!machine_id || (!message?.trim() && photo_paths.length === 0)) {
    return jsonResponse({ error: 'missing_machine_id_or_message' }, 400)
  }
  const userMessage = message?.trim() || "Here's a photo."

  const { data: machine, error: machineError } = await userClient
    .from('machines')
    .select('*')
    .eq('id', machine_id)
    .maybeSingle()
  if (machineError) return jsonResponse({ error: machineError.message }, 500)
  if (!machine) return jsonResponse({ error: 'machine_not_found' }, 404)

  // --- Free-tier enforcement (server-side, per Section 8 security notes) ---
  const [{ count: conversationCount }, { data: profile }, { count: diagnosisCount }] = await Promise.all([
    userClient.from('conversations').select('id', { count: 'exact', head: true }).eq('machine_id', machine_id),
    userClient.from('profiles').select('is_subscribed').eq('id', user.id).maybeSingle(),
    userClient.from('diagnoses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const isFirstMessageOnMachine = (conversationCount ?? 0) === 0
  const isSubscribed = profile?.is_subscribed ?? false
  if (
    ENFORCE_FREE_TIER &&
    isFirstMessageOnMachine &&
    !isSubscribed &&
    (diagnosisCount ?? 0) >= FREE_DIAGNOSIS_LIMIT
  ) {
    return jsonResponse(
      {
        error: 'free_tier_limit_reached',
        message: `You've used your ${FREE_DIAGNOSIS_LIMIT} free diagnoses. Upgrade to keep working with Gus.`,
      },
      402,
    )
  }

  // --- Gather conversation history BEFORE inserting this turn ---
  const { data: historyRows } = await userClient
    .from('conversations')
    .select('role, content')
    .eq('machine_id', machine_id)
    .order('created_at', { ascending: true })

  // --- Knowledge layers ---
  const [machineHistory, pendingDiagnosisRow, spnMatches, manualExcerpts] = await Promise.all([
    getMachineHistory(userClient, machine_id),
    getPendingDiagnosis(userClient, machine_id),
    lookupSpnFmi(userClient, userMessage, machine.make),
    matchManualExcerpts(userClient, machine_id, userMessage),
  ])

  const casePrecedents = await matchCasePrecedents(
    userClient,
    machine.make,
    machine.model,
    pendingDiagnosisRow?.system ?? null,
    userMessage,
  )
  const ruledOutCount = await countRuledOutInOpenCase(userClient, machine_id)

  const symptomKeywords = symptomKeywordsFor(userMessage)
  const cachedCommonIssues = symptomKeywords
    ? await getCachedCommonIssues(userClient, machine.make, machine.model, symptomKeywords)
    : null

  // --- Persist the user's turn ---
  await userClient.from('conversations').insert({
    machine_id,
    user_id: user.id,
    role: 'user',
    content: userMessage,
    mode: 'repair',
    photo_paths,
  })

  // --- Build the current turn's content blocks (text + any photos) ---
  const currentContentBlocks: ClaudeContentBlock[] = [{ type: 'text', text: userMessage }]
  for (const path of photo_paths) {
    try {
      const { data: fileBlob, error: downloadError } = await userClient.storage.from('photos').download(path)
      if (downloadError || !fileBlob) continue
      const base64 = await blobToBase64(fileBlob)
      const mediaType = fileBlob.type && fileBlob.type.startsWith('image/') ? fileBlob.type : 'image/jpeg'
      currentContentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
    } catch {
      // Best-effort — if a photo can't be attached (e.g. unsupported HEIC),
      // continue without it rather than failing the whole turn.
    }
  }

  const claudeMessages: ClaudeMessage[] = [
    ...(historyRows ?? []).map((row: { role: string; content: string }) => ({
      role: (row.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: row.content,
    })),
    { role: 'user', content: currentContentBlocks },
  ]

  const systemPrompt = buildSystemPrompt({
    machine: {
      name: machine.name,
      make: machine.make,
      model: machine.model,
      serial_number: machine.serial_number,
      hours: machine.hours,
    },
    pendingDiagnosis: pendingDiagnosisRow
      ? { tag_number: pendingDiagnosisRow.tag_number, summary: pendingDiagnosisRow.summary, created_at: pendingDiagnosisRow.created_at }
      : null,
    machineHistory,
    spnMatches,
    manualExcerpts,
    casePrecedents,
    cachedCommonIssues,
    ruledOutCount,
    // Give Gus the same live lookup path Claude has when we don't already
    // have a cached common-issues summary for this make/model/symptom.
    hasWebSearchTool: !cachedCommonIssues,
  })

  let anthropicResponse: Response
  try {
    anthropicResponse = await callClaudeStream({
      system: systemPrompt,
      messages: claudeMessages,
      maxTokens: 2048,
      // Re-enabled: turning this off made Gus feel thinner than Claude on
      // make/model-specific failures, TSBs, and documented patterns.
      enableWebSearch: !cachedCommonIssues,
    })
  } catch (err) {
    return jsonResponse({ error: 'claude_request_failed', message: String(err) }, 502)
  }

  const encoder = new TextEncoder()
  const filter = new ResponseStreamFilter()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (payload: unknown) => controller.enqueue(encoder.encode(sse(payload)))

      try {
        for await (const event of parseAnthropicStream(anthropicResponse.body!)) {
          if (event.type === 'text') {
            const safe = filter.feed(event.text)
            if (safe) enqueue({ type: 'text', text: safe })
          } else if (event.type === 'status') {
            enqueue({ type: 'status', status: event.status })
          } else if (event.type === 'final') {
            const tail = filter.flush()
            if (tail) enqueue({ type: 'text', text: tail })

            const parsed = parseModelResponse(event.fullText)
            if (parsed.stage === 'diagnosis' && !parsed.diagnosis) {
              // Rare failure mode: the model declared STAGE:diagnosis but the
              // required fenced block didn't come through (missing or
              // malformed JSON). Surface it in function logs — it means this
              // turn's diagnosis never made it into the diagnoses table.
              console.error('gus-chat: STAGE:diagnosis with no parsable diagnosis-json', {
                stopReason: event.stopReason,
                conversationTailChars: event.fullText.length,
              })
            }

            const { data: assistantRow } = await userClient
              .from('conversations')
              .insert({
                machine_id,
                user_id: user.id,
                role: 'assistant',
                content: parsed.displayText,
                stage: parsed.stage,
                mode: 'repair',
                differential: parsed.differential,
              })
              .select('id')
              .single()

            let createdDiagnosis = null
            if (parsed.diagnosis) {
              const outcome = parsed.diagnosis.outcome === 'no_fault_found' ? 'no_fault_found' : 'pending'
              const { data: diagRow } = await userClient
                .from('diagnoses')
                .insert({
                  machine_id,
                  user_id: user.id,
                  conversation_id: assistantRow?.id ?? null,
                  summary: parsed.diagnosis.summary,
                  safe_to_operate: parsed.diagnosis.safe_to_operate,
                  confidence: parsed.diagnosis.confidence,
                  ranked_causes: parsed.diagnosis.ranked_causes,
                  likely_parts: parsed.diagnosis.likely_parts,
                  repair_steps: parsed.diagnosis.repair_steps ?? [],
                  verification_steps: parsed.diagnosis.verification_steps ?? [],
                  outcome,
                  system: parsed.diagnosis.system,
                  resolved_at: outcome === 'no_fault_found' ? new Date().toISOString() : null,
                })
                .select('*')
                .single()
              createdDiagnosis = diagRow ?? null
            }

            let updatedMachine = null
            if (parsed.machineInfo && (!machine.make.trim() || !machine.model.trim())) {
              const isPlaceholderName = !machine.name.trim() || machine.name === 'New machine'
              const { data: machineRow } = await userClient
                .from('machines')
                .update({
                  make: parsed.machineInfo.make,
                  model: parsed.machineInfo.model || machine.model,
                  name: isPlaceholderName
                    ? parsed.machineInfo.model || parsed.machineInfo.make
                    : machine.name,
                })
                .eq('id', machine_id)
                .select('*')
                .single()
              updatedMachine = machineRow ?? null
              if (updatedMachine) {
                machine.make = updatedMachine.make
                machine.model = updatedMachine.model
                machine.name = updatedMachine.name
              }
            }

            let createdRepair = null
            if (parsed.verifyFix && pendingDiagnosisRow) {
              const { data: repairRow } = await userClient
                .from('repairs')
                .insert({
                  machine_id,
                  user_id: user.id,
                  diagnosis_id: pendingDiagnosisRow.id,
                  parts_replaced: parsed.verifyFix.parts_replaced,
                  verified_fix: parsed.verifyFix.verified_fix,
                  notes: parsed.verifyFix.notes,
                  verified_at: new Date().toISOString(),
                })
                .select('*')
                .single()
              createdRepair = repairRow ?? null

              await userClient
                .from('diagnoses')
                .update({
                  outcome: parsed.verifyFix.verified_fix ? 'fixed' : 'not_fixed',
                  resolved_at: new Date().toISOString(),
                })
                .eq('id', pendingDiagnosisRow.id)

              // Section 6 — the self-learning loop: every verified outcome,
              // fixed or not, becomes a retrievable case precedent.
              const hoursRange =
                machine.hours != null
                  ? `${Math.floor(machine.hours / 500) * 500}-${Math.floor(machine.hours / 500) * 500 + 500}`
                  : null
              const topCause = Array.isArray(pendingDiagnosisRow.ranked_causes) && pendingDiagnosisRow.ranked_causes[0]
                ? pendingDiagnosisRow.ranked_causes[0].cause
                : pendingDiagnosisRow.summary
              await userClient.from('case_precedents').insert({
                user_id: user.id,
                source_machine_id: machine_id,
                make: machine.make,
                model: machine.model,
                hours_range: hoursRange,
                system: pendingDiagnosisRow.system ?? 'Unknown',
                symptom_summary: pendingDiagnosisRow.summary,
                root_cause: topCause,
                confirming_test: null,
                fix_applied:
                  (parsed.verifyFix.parts_replaced ?? []).map((p) => p.name).join(', ') || parsed.verifyFix.notes,
                verified_outcome: parsed.verifyFix.verified_fix,
              })
            }

            // Section 4, item 5 — cache common-issues search results at the
            // make+model level so the next owner of the same model doesn't
            // trigger a redundant paid search call.
            if (event.webSearchUsed && event.sourceUrls.length > 0 && !cachedCommonIssues && symptomKeywords) {
              try {
                const serviceClient = createServiceClient()
                await cacheCommonIssues(
                  serviceClient,
                  machine.make,
                  machine.model,
                  symptomKeywords,
                  parsed.displayText.slice(0, 1000),
                  event.sourceUrls.slice(0, 5),
                )
              } catch {
                // Non-critical — caching failures shouldn't fail the turn.
              }
            }

            enqueue({
              type: 'done',
              stage: parsed.stage,
              diagnosis: createdDiagnosis,
              repair: createdRepair,
              machine: updatedMachine,
              differential: parsed.differential,
            })
          }
        }
      } catch (err) {
        enqueue({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
})
