/** Same wire names as the frontend; see CORE_LOOP / METHODOLOGY in prompt.ts */
export type DiagnosticStage = 'verify' | 'theory' | 'narrow' | 'inspect' | 'diagnosis' | 'test' | 'verify_fix'

/** Logical flow: ask → know system → narrow → targeted check → conclude → confirm test → (loop 4–6) → verify_fix */
const VALID_STAGES: DiagnosticStage[] = [
  'verify',
  'theory',
  'narrow',
  'inspect',
  'diagnosis',
  'test',
  'verify_fix',
]

export interface DiagnosisPayload {
  summary: string
  safe_to_operate: 'yes' | 'no' | 'caution' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  ranked_causes: Array<{ cause: string; likelihood: 'high' | 'medium' | 'low'; confidence?: number; reasoning?: string }>
  likely_parts: Array<{ name: string; part_number?: string }>
  repair_steps?: string[]
  verification_steps?: string[]
  outcome: 'pending' | 'no_fault_found'
  system: string
}

export interface VerifyFixPayload {
  verified_fix: boolean
  notes: string
  parts_replaced: Array<{ name: string; part_number?: string }>
}

export interface MachineInfoPayload {
  make: string
  model: string
}

export interface DifferentialEntry {
  cause: string
  confidence: number
  rationale?: string
}

export interface ParsedResponse {
  stage: DiagnosticStage | null
  displayText: string
  diagnosis: DiagnosisPayload | null
  verifyFix: VerifyFixPayload | null
  machineInfo: MachineInfoPayload | null
  differential: DifferentialEntry[] | null
}

function extractFencedBlock(text: string, lang: string): { json: unknown | null; textWithoutBlock: string } {
  const pattern = new RegExp('```' + lang + '\\s*([\\s\\S]*?)```', 'i')
  const match = text.match(pattern)
  if (!match) return { json: null, textWithoutBlock: text }
  try {
    const json = JSON.parse(match[1].trim())
    return { json, textWithoutBlock: text.replace(match[0], '').trim() }
  } catch {
    return { json: null, textWithoutBlock: text }
  }
}

function parseDifferential(json: unknown): DifferentialEntry[] | null {
  if (!Array.isArray(json)) return null
  const entries = json
    .filter((e): e is { cause: unknown; confidence: unknown; rationale?: unknown } => !!e && typeof e === 'object')
    .map((e) => ({
      cause: typeof e.cause === 'string' ? e.cause.trim() : '',
      confidence: typeof e.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(e.confidence))) : NaN,
      rationale: typeof e.rationale === 'string' ? e.rationale.trim() : undefined,
    }))
    .filter((e) => e.cause && !Number.isNaN(e.confidence))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
  return entries.length > 0 ? entries : null
}

/** Strips the leading STAGE:<name> marker line and any structured fenced blocks
 * from the model's raw reply, returning clean display text plus parsed data. */
export function parseModelResponse(rawText: string): ParsedResponse {
  let text = rawText.trimStart()
  let stage: DiagnosticStage | null = null

  const stageMatch = text.match(/^STAGE:\s*([a-z_]+)\s*\n?/i)
  if (stageMatch) {
    const candidate = stageMatch[1].toLowerCase() as DiagnosticStage
    if (VALID_STAGES.includes(candidate)) stage = candidate
    text = text.slice(stageMatch[0].length)
  }

  const { json: differentialJson, textWithoutBlock: afterDifferential } = extractFencedBlock(text, 'differential-json')
  const { json: diagnosisJson, textWithoutBlock: afterDiagnosis } = extractFencedBlock(afterDifferential, 'diagnosis-json')
  const { json: verifyFixJson, textWithoutBlock: afterVerifyFix } = extractFencedBlock(afterDiagnosis, 'verify-fix-json')
  const { json: machineInfoJson, textWithoutBlock: afterMachineInfo } = extractFencedBlock(afterVerifyFix, 'machine-info-json')

  const machineInfo =
    machineInfoJson && typeof (machineInfoJson as MachineInfoPayload).make === 'string' && (machineInfoJson as MachineInfoPayload).make.trim()
      ? {
          make: (machineInfoJson as MachineInfoPayload).make.trim(),
          model: ((machineInfoJson as MachineInfoPayload).model ?? '').trim(),
        }
      : null

  // Belt-and-suspenders: never let STAGE markers leak into stored/display text.
  const displayText = afterMachineInfo
    .replace(/^\s*STAGE:\s*[a-z_]+\s*$/gim, '')
    .replace(/^\s*STAGE:\s*[a-z_]+\s+/gim, '')
    .trim()

  return {
    stage,
    displayText,
    diagnosis: (diagnosisJson as DiagnosisPayload) ?? null,
    verifyFix: (verifyFixJson as VerifyFixPayload) ?? null,
    machineInfo,
    differential: parseDifferential(differentialJson),
  }
}
