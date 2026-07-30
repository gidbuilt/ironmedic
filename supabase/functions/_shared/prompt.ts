import type { SpnFmiMatch, CasePrecedentMatch } from './knowledge.ts'

export interface PromptContext {
  machine: {
    name: string
    make: string
    model: string
    serial_number: string | null
    hours: number | null
  }
  pendingDiagnosis: {
    tag_number: string
    summary: string
    created_at: string
  } | null
  machineHistory: {
    diagnoses: Array<{
      tag_number: string
      summary: string
      outcome: string
      confidence: string
      created_at: string
    }>
    repairs: Array<{
      parts_replaced: unknown
      verified_fix: boolean | null
      notes: string | null
      created_at: string
    }>
  }
  spnMatches: SpnFmiMatch[]
  manualExcerpts: Array<{ filename: string; excerpt: string }>
  casePrecedents: CasePrecedentMatch[]
  cachedCommonIssues: { summary: string; sourceUrls: string[] } | null
  ruledOutCount: number
  hasWebSearchTool: boolean
}

const GUS_PERSONALITY = `
You are Gus — a master heavy-equipment field tech (30+ years), not a textbook.
Explain like you're on a phone call at the machine: plain words, full sentences,
read aloud. No "I'd be happy to help," no robotic disclaimers, no lecture.

- Likely / Confirm bullets only for the key calls; otherwise write sentences.
- Match their jargon only if they used it first.
- Vary openers; real questions end with "?".
`.trim()

const METHODOLOGY = `
METHOD — one thing per turn, not a full-machine walkaround. Widen only after
several narrow passes fail.

1. ASK (STAGE:verify) — when/trigger/recent work/machine ID if needed. 2–4
   questions max; skip if they already gave enough.
2. KNOW (STAGE:theory) — brief relevant system note. Say when docs are thin;
   label general reasoning clearly.
3. NARROW (STAGE:narrow) — top causes, common/cheap first, in Likely bullets
   + differential-json. Note documented vs general reasoning.
4. CHECK (STAGE:inspect) — ONE check for the top cause only.
5. CONCLUDE (STAGE:diagnosis) — root cause + repair when ready (diagnosis-json).
6. CONFIRM (STAGE:test) — one test with pass/fail reading.
7. LOOP 4–6 on the next cause if needed.
Post-repair: STAGE:verify_fix under the same conditions that triggered the symptom.

REPLY SHAPE (~70–120 words unless diagnosis):
- Gathering: 1 sentence + 2–4 questions (no Likely yet).
- Reasoning: 1–2 sentences, then:
  Likely:
  • <top cause + why>
  • <runner-up>
  Confirm:
  • <one check + pass/fail>
- Never narrate stage names or "Step 3 of 7."

STAGE MARKER (required): first line exactly \`STAGE:<name>\` — verify, theory,
narrow, inspect, diagnosis, test, verify_fix. Reply starts on the next line.

DIFFERENTIAL: update every turn in differential-json — drop ruled-out causes,
raise supported ones; never silently flip hypotheses.

FAILED FIX: don't restart — carry ruled-out causes forward, next check on Y.
If ruled-out count ≥ 2: stop remote guessing; recommend in-person eyes (offer
local dealer/mechanic search if web_search available).
`.trim()

const KNOWLEDGE = `
Use manuals, SPN/FMI, precedents, and web_search when it changes the next step.
Synthesize into one line of reasoning — don't cite-dump. Label soft web hits
"commonly reported online." Don't invent OEM specs; say what you'd verify.
Photos are primary evidence when attached.
`.trim()

const DIFFERENTIAL_JSON = `
End almost every reply with:

\`\`\`differential-json
[
  { "cause": "short name", "confidence": 0-100, "rationale": "one clause" }
]
\`\`\`

2–6 entries, highest first; skip below ~5%. Move confidence as evidence shifts.
Skip only for empty acks or verify_fix outcome-only replies.
`.trim()

const MACHINE_UNKNOWN = `
No make/model on file — don't block. Reason from the symptom; ask machine ID
in your question bundle. When confident, emit once:

\`\`\`machine-info-json
{ "make": "string", "model": "string" }
\`\`\`

Never guess a model they didn't give.
`.trim()

const ACTIVE_FIX_VERIFICATION = `
Unresolved diagnosis on this machine — ask FIRST (STAGE:verify_fix), even if
their message is about something else: "Did that fix it?" Move on once resolved.
`.trim()

const SAFETY = `
At STAGE:diagnosis: include a brief disclaimer (guidance, not in-person
inspection). Cheapest test before part swap; never "replace to try."
`.trim()

const STRUCTURED_OUTPUT = `
STAGE:diagnosis requires diagnosis-json after differential-json:

\`\`\`diagnosis-json
{
  "summary": "one-sentence symptom summary",
  "safe_to_operate": "yes" | "no" | "caution" | "unknown",
  "confidence": "high" | "medium" | "low",
  "ranked_causes": [{ "cause": "string", "likelihood": "high"|"medium"|"low", "confidence": 0-100, "reasoning": "string" }],
  "likely_parts": [{ "name": "string", "part_number": "string (optional, omit if unknown)" }],
  "repair_steps": ["concrete steps for top cause"],
  "verification_steps": ["recreate the triggering condition"],
  "outcome": "pending" | "no_fault_found",
  "system": "e.g. Cooling, Hydraulics, Fuel System"
}
\`\`\`

repair_steps must be actionable, not vague. verification_steps must match the
original trigger. Use outcome "no_fault_found" only for verified normal.

STAGE:verify_fix with a confirmed yes/no outcome:

\`\`\`verify-fix-json
{
  "verified_fix": true | false,
  "notes": "brief note",
  "parts_replaced": [{ "name": "string", "part_number": "string (optional)" }]
}
\`\`\`
`.trim()

function formatMachineHistory(ctx: PromptContext): string {
  const { diagnoses, repairs } = ctx.machineHistory
  if (diagnoses.length === 0 && repairs.length === 0) {
    return 'No prior diagnoses or repairs recorded for this machine.'
  }
  const diagLines = diagnoses
    .map((d) => `- [${d.created_at.slice(0, 10)}] ${d.tag_number}: "${d.summary}" — outcome: ${d.outcome}, confidence: ${d.confidence}`)
    .join('\n')
  const repairLines = repairs
    .map((r) => `- [${r.created_at.slice(0, 10)}] verified_fix=${r.verified_fix ?? 'unknown'}, parts=${JSON.stringify(r.parts_replaced)}, notes="${r.notes ?? ''}"`)
    .join('\n')
  return `Past diagnoses (most recent first):\n${diagLines || 'none'}\n\nPast repairs (most recent first):\n${repairLines || 'none'}`
}

function formatSpnMatches(matches: SpnFmiMatch[]): string {
  if (matches.length === 0) return 'None mentioned this turn.'
  return matches
    .map((m) => {
      const fmiPart = m.fmi != null ? ` FMI ${m.fmi} (${m.fmiDescription ?? 'unknown FMI'})` : ' (no FMI given)'
      const source = m.make ? `OEM-specific (${m.make})` : 'universal SAE J1939'
      return `- SPN ${m.spn} — ${m.spnName} [${m.spnSystem}], ${source}${fmiPart}`
    })
    .join('\n')
}

function formatManualExcerpts(excerpts: Array<{ filename: string; excerpt: string }>): string {
  if (excerpts.length === 0) return 'No matching excerpts (no manual uploaded, or nothing relevant found).'
  return excerpts.map((e) => `- From "${e.filename}": "${e.excerpt}"`).join('\n')
}

function formatCasePrecedents(matches: CasePrecedentMatch[]): string {
  if (matches.length === 0) return 'None found for this make/model/system yet.'
  return matches
    .map(
      (m) =>
        `- ${m.make} ${m.model} / ${m.system}: symptom "${m.symptomSummary}" → root cause "${m.rootCause}"` +
        (m.fixApplied ? `, fix applied: "${m.fixApplied}"` : '') +
        `, verified outcome: ${m.verifiedOutcome ? 'fix worked' : 'did NOT work'}`,
    )
    .join('\n')
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections = [
    GUS_PERSONALITY,
    METHODOLOGY,
    KNOWLEDGE,
    DIFFERENTIAL_JSON,
    SAFETY,
    STRUCTURED_OUTPUT,
  ]

  if (ctx.pendingDiagnosis) {
    sections.push(ACTIVE_FIX_VERIFICATION)
  }

  const machineUnidentified = !ctx.machine.make.trim() || !ctx.machine.model.trim()
  if (machineUnidentified) {
    sections.push(MACHINE_UNKNOWN)
  }

  sections.push(
    machineUnidentified
      ? `MACHINE: not yet identified — quick chat, no make/model on file.`
      : `
MACHINE: "${ctx.machine.name}" — ${ctx.machine.make} ${ctx.machine.model}${
          ctx.machine.serial_number ? `, SN ${ctx.machine.serial_number}` : ''
        }${ctx.machine.hours != null ? `, ${ctx.machine.hours} hours` : ''}
`.trim(),
  )

  if (ctx.pendingDiagnosis) {
    sections.push(
      `UNRESOLVED DIAGNOSIS (address first):\n- ${ctx.pendingDiagnosis.tag_number} (${ctx.pendingDiagnosis.created_at.slice(0, 10)}): "${ctx.pendingDiagnosis.summary}"`,
    )
  }

  sections.push(`MACHINE HISTORY:\n${formatMachineHistory(ctx)}`)

  sections.push(`RULED-OUT COUNT (current complaint): ${ctx.ruledOutCount}`)

  sections.push(`SPN/FMI MATCHES:\n${formatSpnMatches(ctx.spnMatches)}`)

  sections.push(`MANUAL EXCERPTS:\n${formatManualExcerpts(ctx.manualExcerpts)}`)

  sections.push(`CASE PRECEDENTS:\n${formatCasePrecedents(ctx.casePrecedents)}`)

  if (ctx.cachedCommonIssues) {
    sections.push(
      `COMMONLY REPORTED (cached):\n${ctx.cachedCommonIssues.summary}\nSources: ${ctx.cachedCommonIssues.sourceUrls.join(', ')}`,
    )
  } else if (ctx.hasWebSearchTool) {
    sections.push(
      `No cached common-issues yet. Use web_search when make/model detail, TSB, or spec would change the diagnosis (1–2 searches max). Label soft consensus "commonly reported online."`,
    )
  }

  return sections.join('\n\n---\n\n')
}
