import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Knowledge layer 2 & 3 — verified J1939 SPN/FMI lookup
// ---------------------------------------------------------------------------

export interface SpnFmiMatch {
  spn: number
  fmi: number | null
  spnName: string
  spnSystem: string
  fmiDescription: string | null
  make: string | null
}

// Matches "SPN 110", "spn110", "110-5" (spn-fmi shorthand), "code 110".
const SPN_PATTERN = /\b(?:spn\s*)?(\d{2,6})(?:[\s\-/]+(?:fmi\s*)?(\d{1,2}))?\b/gi

export async function lookupSpnFmi(
  userClient: SupabaseClient,
  text: string,
  make: string,
): Promise<SpnFmiMatch[]> {
  const candidates = new Set<number>()
  for (const m of text.matchAll(SPN_PATTERN)) {
    const n = Number(m[1])
    // Cheap noise filter — plausible SPN range, ignores things like "2024" years or hour readings.
    if (n >= 16 && n <= 524287) candidates.add(n)
  }
  if (candidates.size === 0) return []

  const spnList = Array.from(candidates)
  const { data: spnRows } = await userClient
    .from('spn_codes')
    .select('spn, make, name, system')
    .in('spn', spnList)
    .or(`make.is.null,make.eq.${make}`)

  if (!spnRows || spnRows.length === 0) return []

  const fmiMatches = Array.from(text.matchAll(SPN_PATTERN))
    .filter((m) => m[2])
    .map((m) => Number(m[2]))
  const fmiRows = fmiMatches.length
    ? (await userClient.from('fmi_codes').select('fmi, description').in('fmi', fmiMatches)).data
    : []

  return spnRows.map((row: { spn: number; make: string | null; name: string; system: string }) => {
    const fmi = fmiMatches.find((f) => fmiRows?.some((r: { fmi: number }) => r.fmi === f)) ?? null
    const fmiRow = fmi != null ? fmiRows?.find((r: { fmi: number; description: string }) => r.fmi === fmi) : null
    return {
      spn: row.spn,
      fmi,
      spnName: row.name,
      spnSystem: row.system,
      fmiDescription: fmiRow?.description ?? null,
      make: row.make,
    }
  })
}

// ---------------------------------------------------------------------------
// Knowledge layer 1 — user-uploaded manual excerpts (keyword match, no
// embeddings needed at MVP scale)
// ---------------------------------------------------------------------------

// Words too common across any technical manual to be useful discriminators
// (mirrors a tiny hand-picked stopword list rather than pulling in a full
// NLP dependency for a Deno edge function).
const STOPWORDS = new Set([
  'this',
  'that',
  'with',
  'from',
  'have',
  'will',
  'your',
  'when',
  'into',
  'must',
  'been',
  'were',
  'their',
  'also',
  'each',
  'more',
  'than',
  'such',
  'only',
  'they',
  'them',
  'these',
  'those',
  'which',
  'while',
  'should',
  'could',
  'would',
  'about',
  'after',
  'before',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
}

/**
 * Retrieval quality: a density-normalized overlap score (matches weighted
 * by rarity within the query, divided by chunk length) so a short, tightly
 * on-topic chunk beats a long chunk that merely happens to contain a few
 * matching words. Returns a score in roughly [0, 1].
 */
function scoreOverlap(chunk: string, queryWords: Set<string>): number {
  const chunkWords = tokenize(chunk)
  if (chunkWords.length === 0) return 0
  let hits = 0
  const seen = new Set<string>()
  for (const w of chunkWords) {
    if (queryWords.has(w) && !seen.has(w)) {
      hits++
      seen.add(w)
    }
  }
  if (hits === 0) return 0
  const coverage = hits / queryWords.size // how much of the query this chunk addresses
  const density = hits / Math.min(chunkWords.length, 120) // penalize very long, unfocused chunks
  return coverage * 0.7 + density * 0.3
}

// Collapses whitespace/case/punctuation to catch near-duplicate chunks —
// repeated headers, footers, and boilerplate that show up verbatim on
// every page of an OEM manual and would otherwise crowd out real results.
function dedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 200)
}

export async function matchManualExcerpts(
  userClient: SupabaseClient,
  machineId: string,
  queryText: string,
  maxExcerpts = 3,
): Promise<{ filename: string; excerpt: string }[]> {
  const { data: manuals } = await userClient
    .from('manuals')
    .select('filename, extracted_text, extraction_status')
    .eq('machine_id', machineId)
    .eq('extraction_status', 'ok')

  if (!manuals || manuals.length === 0) return []

  const queryWords = new Set(tokenize(queryText))
  if (queryWords.size === 0) return []

  const results: { filename: string; excerpt: string; score: number }[] = []
  const seenChunks = new Set<string>()

  for (const manual of manuals as { filename: string; extracted_text: string | null }[]) {
    if (!manual.extracted_text) continue
    // Chunk by paragraph/page-break approximations, merging tiny fragments
    // (list items, short captions) into their neighbor so a chunk carries
    // enough context to actually be useful once retrieved.
    const rawChunks = manual.extracted_text
      .split(/\n{2,}|\f/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0)

    const chunks: string[] = []
    let buffer = ''
    for (const c of rawChunks) {
      buffer = buffer ? `${buffer}\n${c}` : c
      if (buffer.length >= 120) {
        chunks.push(buffer)
        buffer = ''
      }
    }
    if (buffer.length > 40) chunks.push(buffer)

    for (const chunk of chunks) {
      const key = dedupeKey(chunk)
      if (seenChunks.has(key)) continue // boilerplate/repeated header-footer across pages
      const score = scoreOverlap(chunk, queryWords)
      // Require a minimum score, not just >0, so a single incidental word
      // match doesn't drag an irrelevant chunk into the LLM's context.
      if (score >= 0.12) {
        seenChunks.add(key)
        results.push({ filename: manual.filename, excerpt: chunk.slice(0, 900), score })
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExcerpts)
    .map(({ filename, excerpt }) => ({ filename, excerpt }))
}

// ---------------------------------------------------------------------------
// Section 6 — case precedents (the self-learning table). Scoped to this
// user's own account only, per the "per-account first" rule.
// ---------------------------------------------------------------------------

export interface CasePrecedentMatch {
  make: string
  model: string
  system: string
  symptomSummary: string
  rootCause: string
  fixApplied: string | null
  verifiedOutcome: boolean
}

export async function matchCasePrecedents(
  userClient: SupabaseClient,
  make: string,
  model: string,
  system: string | null,
  symptomText: string,
  maxMatches = 3,
): Promise<CasePrecedentMatch[]> {
  let query = userClient.from('case_precedents').select('*').eq('make', make).eq('model', model)
  if (system) query = query.eq('system', system)

  const { data } = await query.limit(25)
  if (!data || data.length === 0) return []

  interface CasePrecedentRow {
    make: string
    model: string
    system: string
    symptom_summary: string
    root_cause: string
    fix_applied: string | null
    verified_outcome: boolean
  }

  const queryWords = new Set(tokenize(symptomText))
  const scored = (data as CasePrecedentRow[]).map((row) => ({
    row,
    score: scoreOverlap(row.symptom_summary, queryWords),
  }))

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMatches)
    .map(({ row }) => ({
      make: row.make,
      model: row.model,
      system: row.system,
      symptomSummary: row.symptom_summary,
      rootCause: row.root_cause,
      fixApplied: row.fix_applied,
      verifiedOutcome: row.verified_outcome,
    }))
}

// ---------------------------------------------------------------------------
// Section 4, item 5 — common-issues web-search cache (make+model level)
// ---------------------------------------------------------------------------

const CACHE_MAX_AGE_DAYS = 90

export async function getCachedCommonIssues(
  userClient: SupabaseClient,
  make: string,
  model: string,
  symptomKeywords: string,
): Promise<{ summary: string; sourceUrls: string[] } | null> {
  const cutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await userClient
    .from('common_issues_cache')
    .select('search_results_summary, source_urls, cached_at')
    .eq('make', make)
    .eq('model', model)
    .eq('symptom_keywords', symptomKeywords)
    .gte('cached_at', cutoff)
    .maybeSingle()

  if (!data) return null
  return { summary: data.search_results_summary, sourceUrls: (data.source_urls as string[]) ?? [] }
}

export async function cacheCommonIssues(
  serviceClient: SupabaseClient,
  make: string,
  model: string,
  symptomKeywords: string,
  summary: string,
  sourceUrls: string[],
): Promise<void> {
  await serviceClient
    .from('common_issues_cache')
    .upsert(
      { make, model, symptom_keywords: symptomKeywords, search_results_summary: summary, source_urls: sourceUrls, cached_at: new Date().toISOString() },
      { onConflict: 'make,model,symptom_keywords' },
    )
}

// ---------------------------------------------------------------------------
// Gap 2 — this machine's OWN stored repair/fault history (ask / early stages)
// ---------------------------------------------------------------------------

export async function getMachineHistory(userClient: SupabaseClient, machineId: string) {
  const [{ data: diagnoses }, { data: repairs }] = await Promise.all([
    userClient
      .from('diagnoses')
      .select('tag_number, summary, safe_to_operate, confidence, outcome, created_at, resolved_at')
      .eq('machine_id', machineId)
      .order('created_at', { ascending: false })
      .limit(10),
    userClient
      .from('repairs')
      .select('parts_replaced, verified_fix, failure_type, notes, verified_at, created_at')
      .eq('machine_id', machineId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  return { diagnoses: diagnoses ?? [], repairs: repairs ?? [] }
}

// Section 3 (Active fix-verification) — any diagnosis with no recorded
// outcome yet. Not gated strictly to 48h here: the spec's UI/notification
// sweep enforces the 48h threshold for *proactively surfacing* a prompt;
// conversationally, Gus should ask about ANY unresolved diagnosis before
// moving on to something new, per Section 3's "asks about it first" rule.
export async function getPendingDiagnosis(userClient: SupabaseClient, machineId: string) {
  const { data } = await userClient
    .from('diagnoses')
    .select('*')
    .eq('machine_id', machineId)
    .eq('outcome', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Convergence limit — count ruled-out hypotheses since the last resolved
// diagnosis on this machine (a fresh "case" starts after fixed/no_fault_found).
export async function countRuledOutInOpenCase(userClient: SupabaseClient, machineId: string): Promise<number> {
  const { data } = await userClient
    .from('diagnoses')
    .select('id, outcome, created_at')
    .eq('machine_id', machineId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!data) return 0
  let count = 0
  for (const d of data as { outcome: string }[]) {
    if (d.outcome === 'fixed' || d.outcome === 'no_fault_found') break
    if (d.outcome === 'not_fixed') count++
  }
  return count
}
