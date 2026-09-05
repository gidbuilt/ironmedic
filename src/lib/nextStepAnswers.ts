export type AnswerChip = { label: string; send: string }

export type NextStepAnswers = {
  /** Short directive shown on the tile — must name the check/question. */
  question: string
  /** Fuller how-to from Gus's Next Step (for expand). */
  howTo: string | null
  answers: AnswerChip[]
}

type Topic =
  | 'symptom'
  | 'make'
  | 'vibration'
  | 'hydraulics_which'
  | 'cold_warm'
  | 'smoke'
  | 'level'
  | 'light'
  | 'voltage'
  | 'ohms'
  | 'relay'
  | 'duration'
  | 'load'
  | 'smell'
  | 'photo'
  | 'scan'
  | 'pressure'
  | 'yesno'
  | 'check'

function clean(s: string): string {
  return s
    .replace(/\*\*?/g, '')
    .replace(/`+/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Soft cap only for runaway strings — chips must stay fully readable. */
function clipLabel(s: string, max = 72): string {
  const t = clean(s)
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

function clipWords(s: string, maxWords = 22): string {
  const words = clean(s).split(' ').filter(Boolean)
  if (words.length <= maxWords && clean(s).length <= 220) return clean(s)
  return `${words.slice(0, maxWords).join(' ').replace(/[.…]+$/, '')}…`
}

function capitalize(s: string): string {
  const t = clean(s)
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function toChips(labels: string[], question: string, maxChips = 7): AnswerChip[] {
  const seen = new Set<string>()
  const out: AnswerChip[] = []
  const q = clean(question).replace(/\s*[—–-]\s*what do you (find|get|see)\?\s*$/i, '')
  for (const raw of labels) {
    const label = clipLabel(raw.replace(/^[→\-–—*•]+\s*/, ''))
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    // Always send label + which ask it answers, so Gus doesn't re-ask the same check
    const send = /^(yes|no|i'?m not sure|not sure)$/i.test(label)
      ? `${label} — ${q}`
      : `${label} (re: ${q})`
    out.push({ label, send })
    if (out.length >= maxChips) break
  }
  return out
}

function stripPipes(body: string): string {
  return body
    .replace(/\*\*?/g, '')
    .replace(/`+/g, '')
    .replace(/(?:→|->)\s*[\s\S]+$/m, '')
    .trim()
}

function isFiller(s: string): boolean {
  return (
    /^(no parts|minimal risk|here'?s|before you|park on|let'?s slow|safety first|with the engine|keep the meter|that'?s|good —|fair enough|no worries|no problem|do this check)\b/i.test(
      s,
    ) || /\b(low-risk|wheel chocked|park brake set)\b/i.test(s)
  )
}

/** Safety / legal disclaimer — never the Next Step ask or how-to headline. */
export function isDisclaimer(s: string): boolean {
  const t = clean(s).toLowerCase()
  return (
    /\b(straight talk|diagnostic guidance|not a substitute|in-person (check|inspection)|qualified (tech|technician|mechanic)|ai-assisted guidance|not a shop manual)\b/i.test(
      t,
    ) || /^this is (ai|diagnostic|guidance)\b/i.test(t)
  )
}

/** True when the tile headline is a real operator ask/check — not legalese or junk. */
export function isUsableNextStepQuestion(q: string): boolean {
  const t = clean(q)
  if (!t || t.length < 8) return false
  if (isDisclaimer(t)) return false
  if (/\b(straight talk|not a substitute|diagnostic guidance|qualified tech)\b/i.test(t)) return false
  if (/^check what gus described\b/i.test(t)) return false
  // Must look like a question, tell-me, or concrete check
  return (
    /\?/.test(t) ||
    /^(tell me|check|test|measure|watch|look|put |hook |read |which|what|when|where|how|does|did|is |are )\b/i.test(
      t,
    ) ||
    /\b(what do you|tell me)\b/i.test(t)
  )
}

function stripDisclaimers(body: string): string {
  // Keep → chip lines intact — only strip markdown/filler/disclaimer prose.
  return body
    .replace(/\*\*?/g, '')
    .replace(/`+/g, '')
    .split('\n')
    .map((l) => clean(l.replace(/^(?:[-*•▪︎]|\d+[.)])\s+/, '')))
    .filter(Boolean)
    .flatMap((line) => {
      // Preserve the tap-answer line whole
      if (/(?:→|->)/.test(line) && line.includes('|')) return [line]
      const parts = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [line]
      return parts.map(clean).filter(Boolean)
    })
    .filter((s) => !isDisclaimer(s))
    .join('\n')
    .trim()
}

function isQuestion(s: string): boolean {
  return /\?\s*$/.test(s) || /^(when|what|where|which|how|does|do |is |are |did |can |have |has )\b/i.test(s)
}

function isImperative(s: string): boolean {
  return /^(check|test|measure|watch|tell me|try|do |find |look |note |unplug|start |go |pick |choose |put |take |read )\b/i.test(
    s,
  )
}

function isSymptomAsk(text: string): boolean {
  const t = clean(text).toLowerCase()
  return (
    /\b(what('?s| is) (it |the machine |she )?(doing|wrong)|what'?s going on|what'?s the .{0,24}symptom|tell me .{0,40}symptom|main symptom|describe (the )?(problem|symptom|what)|pin down what|once i know the symptom|what is it doing|what'?s wrong with|what is wrong)\b/i.test(
      t,
    ) || /\bwhat'?s it doing wrong\b/i.test(t)
  )
}

/** True when the ask wants two (or more) observations — Yes/No is ambiguous. */
function isCompoundObservationAsk(text: string): boolean {
  const t = clean(text).toLowerCase()
  const whetherCount = (t.match(/\bwhether\b/g) ?? []).length
  if (whetherCount >= 2) return true
  if (/\b(tell me|check|note)\b.+\band\b.+\b(whether|if|what|how|when)\b/.test(t)) return true
  if (/\bwhether\b.+\band\b.+\b(whether|if|hear|see|feel|blows?|click|look)\b/.test(t)) return true
  if (/\btell me if\b.+\band\b.+\b(what|whether|if|how)\b/.test(t)) return true
  // Comma-separated observation list: "oil level, if you see foam, and whether…"
  if (/\boil\b/.test(t) && /\b(foam|foamy|aerat|sight glass|level)\b/.test(t)) return true
  // cold vs warm + idle vs driving + CEL style gathers
  if (/\b(cold|warm)\b/.test(t) && /\b(idle|driv)\b/.test(t)) return true
  if (/\b(check engine|cel\b|mil\b)\b/.test(t) && /\b(cold|warm|idle|driv|whether)\b/.test(t)) {
    return true
  }
  if (
    /\bfan\b/.test(t) &&
    /\b(click|clutch|compressor)\b/.test(t) &&
    /\band\b/.test(t)
  ) {
    return true
  }
  return false
}

/**
 * "Where's the leak / oil coming from?" — location forks, not severity.
 */
function chipsForLeakSourceAsk(ask: string, contextExtra = ''): string[] | null {
  const t = clean(`${ask} ${contextExtra}`).toLowerCase()
  const isWhere =
    /\bwhere('?s| is| from)\b/.test(t) ||
    /\bcoming from\b/.test(t) ||
    /\b(source of|pin down the source|find the source)\b/.test(t)
  const isLeak =
    /\b(leak|leaking|seep|weep|oil|hydraulic|fluid)\b/.test(t) ||
    /\bwhere.?s the oil\b/.test(t)
  if (!isWhere || !isLeak) return null

  // Prefer locations Gus already named in Summary / Next Step prose
  const fromProse = extractLeakLocationsFromProse(`${ask}\n${contextExtra}`)
  if (fromProse.length >= 3) {
    return dedupeLabels([...fromProse.slice(0, 6), 'Not sure', "I'll type it"])
  }

  return [
    'Cylinder rod seal',
    'Hose end / fitting',
    'Pump shaft',
    'Valve bank',
    'Tank / return line',
    'Not sure',
    "I'll type it",
  ]
}

/** Pull common leak spots from Gus's prose so chips match what he said. */
function extractLeakLocationsFromProse(text: string): string[] {
  const t = clean(text).toLowerCase()
  const chips: string[] = []
  const add = (label: string, re: RegExp) => {
    if (re.test(t)) chips.push(label)
  }
  add('Cylinder rod seal', /\b(cylinder|rod)\b.*\bseal|\brod seal|\bcylinder seal\b/)
  add('Hose end / fitting', /\b(hose|fitting|quick.?coupl|banjo)\b/)
  add('Pump shaft', /\bpump\b.*\b(shaft|seal)|pump shaft\b/)
  add('Valve bank', /\b(valve bank|control valve|main valve|spool)\b/)
  add('Tank / return line', /\b(return|suction|tank)\b.*\b(line|hose|fitting)?|\btank\b/)
  add('Under the machine / puddle', /\b(under|puddle|ground|floor)\b/)
  add('Swing / center joint', /\b(swing|center joint|swivel)\b/)
  return dedupeLabels(chips)
}

/**
 * Oil / foam / cavitation sight-glass forks — chips must cover every ask in the text.
 */
function chipsForOilFoamAsk(ask: string): string[] | null {
  const t = clean(ask).toLowerCase()
  const hasOil =
    /\b(oil level|fluid level|sight glass|how full|oil full|looks full|looks low)\b/.test(t) ||
    (/\boil\b/.test(t) && /\b(level|full|low)\b/.test(t))
  const hasFoam = /\b(foam|foamy|aerat|bubbl)\b/.test(t)
  const hasIdle =
    /\b(low idle|high idle|throttle|rpm|rev)\b/.test(t) &&
    /\b(whine|noise|growl|sound|vibrat|there|worse|only)\b/.test(t)

  if (!hasOil && !hasFoam) return null

  const chips: string[] = []
  if (hasOil || hasFoam) {
    chips.push('Oil full / no foam')
    chips.push('Oil low')
    if (hasFoam) chips.push('Foamy / aerated')
    else chips.push('Looks full')
  }
  if (hasIdle) {
    chips.push('Whine at high idle')
    chips.push('Whine at low idle')
  }
  chips.push('Not sure')
  return dedupeLabels(chips)
}

/**
 * Multi-condition gathers (cold/warm + idle/driving + CEL, etc.) —
 * include a chip for every dimension named in the ask.
 */
function chipsForMultiConditionAsk(ask: string): string[] | null {
  const t = clean(ask).toLowerCase()
  const hasTemp = /\b(cold|warm|hot)\b/.test(t) && /\b(vs|or|when|worse|rough)\b/.test(t)
  const hasLoad =
    /\b(idle vs|vs driving|idle or driv|under load|while driv|at idle)\b/.test(t) ||
    (/\bidle\b/.test(t) && /\b(driv|load|cruise|highway)\b/.test(t))
  const hasCel =
    /\b(check engine|cel\b|mil\b|service engine|wrench light|fault light)\b/.test(t) ||
    /\b(light ever|light come|light came|light on)\b/.test(t)

  const dimCount = [hasTemp, hasLoad, hasCel].filter(Boolean).length
  // Only take over when 2+ dimensions are asked (single cold/warm stays on topic chips)
  if (dimCount < 2 && !(hasCel && (hasTemp || hasLoad))) return null
  if (!hasTemp && !hasLoad && !hasCel) return null

  const chips: string[] = []
  if (hasTemp) {
    chips.push('Worse when cold', 'Worse when warm')
  }
  if (hasLoad) {
    chips.push('Rough at idle', 'Rough while driving')
  }
  if (hasCel) {
    chips.push('CEL came on', 'No CEL')
  }
  if (hasTemp && !hasLoad) chips.push('Same either way')
  chips.push('Not sure')
  return dedupeLabels(chips)
}

function dedupeLabels(chips: string[]): string[] {
  const seen = new Set<string>()
  return chips.filter((c) => {
    const k = c.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** True only when the ask itself is a single binary yes/no — not "tell me the…". */
function isBinaryAsk(text: string): boolean {
  const t = clean(text).toLowerCase()
  if (isSymptomAsk(t) || isMakeAsk(t) || isCompoundObservationAsk(t)) return false
  if (/\btell me if\b|\bwhether\b/.test(t)) return true
  if (/^(does|did|is|are|can|have|has|was|were)\b/.test(t) && !/\bor\b/.test(t)) return true
  return false
}

/**
 * Turn a compound "whether A and whether B" ask into combo chips that answer both.
 * Only returns short, known patterns — never long truncated phrase fragments.
 */
function chipsFromCompoundAsk(ask: string): string[] | null {
  const t = clean(ask).toLowerCase()

  const oilFoam = chipsForOilFoamAsk(ask)
  if (oilFoam) return oilFoam

  const multiCond = chipsForMultiConditionAsk(ask)
  if (multiCond) return multiCond

  const travelSafety = chipsForTravelSafetyAsk(ask)
  if (travelSafety) return travelSafety

  // A/C: fan airflow + compressor clutch click
  if (/\bfan\b/.test(t) && /\b(click|clutch)\b/.test(t)) {
    return ['Fan blows + click', 'Fan blows, no click', 'No fan / no air', 'Not sure']
  }

  // Drift + rod (also compound)
  if (/\bdrift/.test(t) && /\brod\b/.test(t)) {
    return ['Drifts', 'Holds / no drift', 'Rod scored or wet', 'Rod looks clean']
  }

  // Noise character + when it happens → prefer vibration chips over "A only / B only"
  if (/\b(vibrat|noise|shake|rattle|knock)\b/.test(t) && !/\boil\b/.test(t)) {
    return null
  }

  // Only invent combo chips from short observation labels (≤18 chars each)
  const split = clean(ask).split(
    /\s+and\s+(?:whether\s+(?:you\s+|the\s+|it\s+)?|if\s+(?:you\s+|the\s+|it\s+)?|what\s+)/i,
  )
  if (split.length >= 2) {
    const left = clean((split[0] ?? '').replace(/^.*?\b(?:whether|if|tell me)\s+/i, ''))
    const right = clean(
      (split[1] ?? '')
        .replace(/\s*[—–-].*$/, '')
        .replace(/\s*,?\s+and\s+(i'?ll|we'?ll|that)\b[\s\S]*$/i, '')
        .replace(/\?.*$/, ''),
    )
    const a = shortObservationLabel(left)
    const b = shortObservationLabel(right)
    if (
      a &&
      b &&
      a.toLowerCase() !== b.toLowerCase() &&
      a.length <= 18 &&
      b.length <= 18
    ) {
      return [`${a} + ${b}`, `${a} only`, `${b} only`, 'Neither / not sure']
    }
  }

  return null
}

/** Compress "the fan blows" / "you hear that click" into a short chip fragment. */
function shortObservationLabel(clause: string): string | null {
  let s = clean(clause)
    .replace(/^(the|a|an|you|it|there|whether|if)\s+/i, '')
    .replace(/^(the|a|an|you|it)\s+/i, '')
  if (!s || s.length < 3) return null

  if (/\bfan\b/i.test(s) && /\b(blow|blows|running|on|air)\b/i.test(s)) return 'Fan blows'
  if (/\bfan\b/i.test(s)) return 'Fan blows'
  if (/\b(click|clunk|clutch)\b/i.test(s)) return 'Hear click'
  if (/\bdrift/i.test(s)) return 'Drifts'

  // Refuse long/unknown phrases — those become truncated useless chips
  s = s
    .replace(/\b(that|this|the|a|an|you|your|me|whether|if)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return null
  const words = s.split(' ')
  if (words.length > 3 || s.length > 18) return null
  return capitalize(s)
}

/**
 * Label Yes/No from a single whether/does ask so chips aren't bare Yes/No when avoidable.
 */
function labeledBinaryChips(ask: string): string[] | null {
  const t = clean(ask).toLowerCase()
  if (/\bfan\b/.test(t) && /\b(blow|air|breeze)\b/.test(t)) {
    return ['Fan blows', 'No fan / no air', 'Not sure', "I'll type more"]
  }
  if (/\b(click|clutch)\b/.test(t)) {
    return ['Hear the click', 'No click', 'Not sure', "I'll type more"]
  }
  if (/\bdrift/.test(t)) {
    return ['Yes — it drifts', 'No — holds position', 'Not sure', "I'll type more"]
  }
  // "whether the X …" → keep Yes/No only as last resort for true single binaries
  return null
}

function isMakeAsk(text: string): boolean {
  return /\b(what'?s? the (make|brand)|what (make|brand)|which (make|brand)|is (it|this) (a |an )?(cat|deere|john deere|komatsu|hitachi|volvo|case|kubota))\b/i.test(
    clean(text),
  )
}

function isVagueNextStep(text: string): boolean {
  const t = clean(text).toLowerCase()
  return (
    /\b(that one answer|let me narrow|once i know|what do you find\??$|narrow the likely|couple details|point us at)\b/i.test(
      t,
    ) && !/\b(check|measure|gauge|ohm|volt|port|pressure|when is|what does|which )\b/i.test(t)
  )
}

function isBannedChip(label: string): boolean {
  return /^(looks good|looks wrong|can'?t do that yet|done — .+)$/i.test(clean(label))
}

function detectTopic(body: string): Topic {
  // Prefer the short ask line — full how-tos often mention cold/warm as context
  // and would steal chips from the real check (e.g. a pressure test).
  const lines = stripPipes(body)
    .split('\n')
    .map((l) => clean(l))
    .filter(Boolean)
  const headline =
    lines.find((l) => /\?/.test(l) || /^(check|test|measure|watch|tell me|put |hook |what)/i.test(l)) ??
    lines[0] ??
    body
  const primary = clean(headline).toLowerCase()
  const full = clean(body).toLowerCase()

  const score = (re: RegExp, text: string) => (re.test(text) ? 1 : 0)

  // Gathering asks first — never use "Looks good" check chips here
  if (isSymptomAsk(primary) || isSymptomAsk(full)) return 'symptom'
  if (isMakeAsk(primary) || isMakeAsk(full)) return 'make'

  // Vibration / noise — only from the ask / next-step line, or clear vibration focus
  if (score(/\b(vibrat|rattl|knock|noise|hum|whine|squeal|buzz|shake|shaking)\b/, primary)) {
    return 'vibration'
  }

  // Which hydraulic circuit — ONLY when the ask itself is about weak/which functions
  // (do not match just because the summary listed "hydraulic pumps" as a vibration source)
  if (
    !score(/\b(pressure|gauge|port|psi)\b/, primary) &&
    (score(/\b(which function|feel weak|feel slow|are weak|are slow)\b/, primary) ||
      (score(/\b(weak|slow)\b/, primary) &&
        score(/\b(lift|boom|travel|swing|hydraulic|all functions)\b/, primary)))
  ) {
    return 'hydraulics_which'
  }

  // Soft: vibration mentioned in surrounding context when next step is vague
  if (
    score(/\b(vibrat|rattl|knock|noise|hum|whine|squeal|buzz|shake|shaking)\b/, full) &&
    !score(/\b(weak|slow|which function)\b/, primary)
  ) {
    return 'vibration'
  }

  // Measurement / tool checks win over symptom-timing chips
  if (
    score(/\b(test port|pressure (test )?gauge|psi|deadhead|working pressure|outlet pressure|relief pressure|charge pressure)\b/, primary) ||
    (score(/\bgauge\b/, primary) && score(/\b(pressure|port|hydraulic)\b/, primary)) ||
    score(/\b(test port|deadhead|working pressure|outlet pressure)\b/, full)
  ) {
    return 'pressure'
  }
  if (score(/\b(icp|scan tool)\b/, primary) || score(/\b(icp|scan tool)\b/, full)) {
    return 'scan'
  }
  if (score(/\b(volt|voltage|12\s*v)\b/, primary)) return 'voltage'
  if (score(/\b(ohm|resistance)\b/, primary) && score(/\b(multimeter|glow.?plug|ohm|resistance)\b/, full)) {
    return 'ohms'
  }
  if (score(/\b(relay|energiz)\b/, primary)) return 'relay'

  // Timing forks only when the ask itself is about cold/warm
  if (
    score(/\bcold\b/, primary) &&
    score(/\b(warm|hot)\b/, primary) &&
    !score(/\b(pressure|gauge|port|volt|ohm)\b/, primary)
  ) {
    return 'cold_warm'
  }
  if (
    score(/\b(first minute|first 30|first 60|right after (a )?cold|once (it'?s |it is )?warm)\b/, primary) &&
    !score(/\b(pressure|gauge|port)\b/, primary)
  ) {
    return 'cold_warm'
  }

  if (score(/\b(smoke|stack|exhaust)\b/, primary) && !score(/\b(relay|voltage|ohm)\b/, primary)) {
    return 'smoke'
  }
  if (
    score(/\b(sight glass|coolant level|oil level|fluid level|overflow bottle|dipstick|how full)\b/, primary) ||
    score(/\bbetween the marks\b/, primary)
  ) {
    return 'level'
  }
  if (
    score(/\b(wait.?to.?start|glow.?plug light|dash light)\b/, primary) ||
    (score(/\blight\b/, primary) && score(/\b(key.?on|glow|come on|stays? off)\b/, primary))
  ) {
    return 'light'
  }
  if (score(/\b(how long|just start|been happening|when did (it|this)|brand.?new)\b/, primary)) {
    return 'duration'
  }
  if (score(/\b(under load|at idle|idle vs)\b/, primary)) return 'load'
  if (score(/\b(smell|odor|raw fuel)\b/, primary)) return 'smell'
  if (score(/\b(photo|picture|snap a )\b/, primary)) return 'photo'
  if (
    /^(is |are |does |did |can |have |has |was |were )/i.test(clean(headline)) &&
    !/\bor\b/.test(primary) &&
    !/\bcheck\b/.test(primary)
  ) {
    return 'yesno'
  }
  return 'check'
}

const TOPIC_CHIPS: Record<Topic, string[]> = {
  symptom: [
    'Weak / slow hydraulics',
    "Won't start or hard start",
    "Won't travel / swing",
    'Noise or vibration',
  ],
  make: ['John Deere', 'Cat', 'Komatsu', 'Other — I’ll type it'],
  vibration: [
    'Rattle / shake',
    'Loud knocking',
    'Matches engine RPM',
    'Only with hydraulics',
  ],
  hydraulics_which: ['All functions', 'Lift / boom only', 'Travel only', 'Swing only'],
  cold_warm: ['Worse when cold', 'Worse when warm', 'Same either way', 'Not sure'],
  smoke: ['White / gray', 'Black', 'Blue', 'No smoke'],
  level: ['Looks full', 'Looks low', "Can't see", 'Not sure'],
  light: ['Light comes on', 'Light stays off', "Didn't watch", 'Not sure'],
  voltage: ['Got voltage', 'No voltage', "Can't measure", 'Not sure'],
  ohms: ['Reading OK', 'Reading bad', "Can't measure", 'Not sure'],
  relay: ['Has power', 'No power', "Can't tell", 'Not sure'],
  duration: ['Just started', 'Been a while', 'Getting worse', 'Not sure'],
  load: ['At idle', 'Under load', 'Both', 'Not sure'],
  smell: ['Yes — strong smell', 'No smell', 'Not sure'],
  photo: ["I'll attach a photo", "Can't take a photo", 'Not sure'],
  scan: ['Looks normal', 'Looks low / high', "Can't get a reading", 'Not sure'],
  pressure: ['At / near spec', 'Low / below spec', "Can't get a reading", 'Not sure'],
  yesno: ['Yes', 'No', "Not sure"],
  // Actionable check fallback — findings, not bare Yes/No
  check: ['Looks normal', 'Looks wrong / off', "Can't check yet", 'Not sure', "I'll type it"],
}

/** Short stock questions only when we can name the thing being checked. */
const TOPIC_FALLBACK_ASK: Partial<Record<Topic, string>> = {
  symptom: "What's it doing wrong?",
  make: "What's the make — John Deere, Cat, or something else?",
  vibration: 'What does that vibration / noise feel or sound like?',
  hydraulics_which: 'Which functions feel weak or slow?',
  cold_warm: 'When is the rough running worse — cold or warm?',
  smoke: 'Start it and watch the exhaust — what color is the smoke?',
  level: 'Check the fluid level — what do you see?',
  light: 'On cold key-on, does the wait-to-start light come on?',
  voltage: 'Measure voltage at the relay — what do you get?',
  ohms: 'Measure glow-plug resistance — how do they read?',
  relay: 'Check whether the relay is sending power — what do you find?',
  duration: 'How long has this been happening?',
  load: 'Does it happen at idle, under load, or both?',
  smell: 'Do you smell raw fuel in the exhaust?',
  photo: 'Can you attach a photo of what you see?',
  scan: 'Check the scan/gauge reading — what do you see?',
  pressure: 'Check system pressure at the test port with a gauge — what do you get?',
}

function sentencesOf(body: string): string[] {
  return stripPipes(body)
    .split('\n')
    .map((l) => clean(l.replace(/^(?:[-*•▪︎]|\d+[.)])\s+/, '')))
    .filter(Boolean)
    .flatMap((l) => l.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [l])
    .map(clean)
    .filter((s) => s && !isFiller(s) && !isDisclaimer(s))
}

function isCommentary(s: string): boolean {
  return /\b(fork in the road|that decides|the tell|rules out|points at|leans toward|means the|theory'?s dead|cheap stuff|what do you find\?$)\b/i.test(
    s,
  ) || /^(that |this |good —|fair |no worries|weak |clean filter)/i.test(s)
}

/**
 * Build a short, named check from measurement language in the body.
 * e.g. gauge on main system test port → "Check main system test port pressure with a gauge"
 */
function extractNamedMeasurement(body: string): string | null {
  const text = stripPipes(body)

  const gaugeOn = text.match(
    /\b(?:put|hook|connect|install|attach|screw)\s+(?:a\s+)?(?:\w+\s+){0,4}gauge\s+on\s+(?:the\s+)?([^,.!?\n(]{5,70})/i,
  )
  if (gaugeOn?.[1]) {
    let target = clean(gaugeOn[1])
      .replace(/\s+and\s+(?:check|read|measure|compare|hold|deadhead)\b[\s\S]*$/i, '')
      .replace(/\s+while\b[\s\S]*$/i, '')
      .replace(/\s+at\s+high idle\b[\s\S]*$/i, '')
      .replace(/[,:;]+$/, '')
    if (!/\bpressure\b/i.test(target)) target = `${target} pressure`
    return `Check ${target} with a gauge`
  }

  const readWorking = text.match(
    /\bread\s+(working pressure|system pressure|outlet pressure|relief pressure|charge pressure|pump pressure|main pressure)([^,.!?\n]{0,40})/i,
  )
  if (readWorking?.[1]) {
    const extra = clean(readWorking[2] ?? '')
    const port = text.match(/\b((?:main\s+)?(?:system\s+)?(?:pump\s+)?(?:outlet\s+)?test port)\b/i)?.[1]
    if (port) return `Check ${clean(port)} ${clean(readWorking[1])} with a gauge`
    return `Check ${clean(readWorking[1])}${extra ? ` ${extra}` : ''} with a gauge`
  }

  // Named ports / pressures mentioned with gauge or measure context
  const named = text.match(
    /\b((?:main\s+)?(?:pump\s+)?(?:outlet\s+)?(?:system\s+)?(?:test\s+)?port|(?:main\s+)?(?:pump\s+)?outlet pressure|(?:main\s+)?(?:system\s+)?relief pressure|charge pressure|working pressure)\b/i,
  )
  if (named?.[1] && /\b(gauge|psi|pressure|deadhead|measure|read)\b/i.test(text)) {
    let label = clean(named[1])
    if (/\bport\b/i.test(label) && !/\bpressure\b/i.test(label)) {
      label = `${label} pressure`
    }
    return `Check ${label} with a gauge`
  }

  // ICP / electrical style named readings
  const icp = text.match(/\b(ICP(?:\s+pressure)?|rail pressure|fuel pressure)\b/i)
  if (icp?.[1] && /\b(scan|gauge|watch|read|psi)\b/i.test(text)) {
    return `Check ${clean(icp[1])} on a scan tool or gauge`
  }

  return null
}

/**
 * Pull a concrete action line that names what to check.
 * Never returns a vague "do this check".
 */
function extractSpecificAction(body: string): string | null {
  const named = extractNamedMeasurement(body)
  if (named) return named

  const sentences = sentencesOf(body)
  const scored = [...sentences].reverse()

  const actionRe =
    /\b(check|test|measure|watch|inspect|verify|read|unplug|reconnect|find|look at|put .+ on|probe|gauge)\b/i
  const concreteRe =
    /\b(gauge|port|pressure|psi|ohm|volt|multimeter|relay|filter|sight glass|ICP|temperature|smoke|exhaust)\b/i

  // Prefer a concrete measurement/action sentence over commentary
  const concreteAction = scored.find(
    (s) =>
      actionRe.test(s) &&
      concreteRe.test(s) &&
      !isCommentary(s) &&
      s.length >= 16 &&
      !/^do this check/i.test(s) &&
      !/\bthis check\b/i.test(s),
  )
  if (concreteAction) return concreteAction

  // Prefer a question that names something concrete
  const q = scored.find(
    (s) =>
      s.includes('?') &&
      s.length >= 12 &&
      !/^do this check/i.test(s) &&
      !isCommentary(s) &&
      concreteRe.test(s),
  )
  if (q) return q

  const action = scored.find(
    (s) =>
      actionRe.test(s) &&
      s.length >= 16 &&
      !isCommentary(s) &&
      !/^do this check/i.test(s) &&
      !/\bthis check\b/i.test(s) &&
      !/^check and tell me/i.test(s),
  )
  if (action) return action

  const m = stripPipes(body).match(
    /\b((?:check|test|measure|watch|inspect|verify|read)\s+(?:the\s+)?(?!this\b|and\b|it\b|what\b)[a-z][a-z0-9/ -]{4,80})/i,
  )
  if (m?.[1] && !/\bthis check\b/i.test(m[1]) && !/^check and\b/i.test(m[1]) && !isCommentary(m[1])) {
    return clean(m[1])
  }

  const first = scored.find((s) => s.split(' ').length >= 5 && s.length >= 20 && !isCommentary(s))
  return first ?? null
}

function withReportBack(action: string): string {
  let t = clean(action)
    .replace(
      /^(easiest first check|best single check|next check|first check|one check|the check)[:\s—–-]*/i,
      '',
    )
    .replace(/^(let'?s |you'?re just |just |now |next[,:]?\s*)/i, '')
    .replace(/^do this check\b[^.!?]*/i, '')
    .replace(/\bthis check\b/gi, 'it')

  t = clean(t)
  if (!t || /^and tell me/i.test(t) || t.length < 10) {
    return ''
  }

  // Prefer ask half after em-dash if shorter/clearer
  if (t.length > 80) {
    const parts = t.split(/\s*[—–:]\s*/).map(clean).filter(Boolean)
    const askPart = [...parts].reverse().find(
      (p) => (isQuestion(p) || isImperative(p) || /\btell me\b/i.test(p)) && p.length >= 12,
    )
    if (askPart) t = askPart
  }

  if (isQuestion(t) || /\?\s*$/.test(t)) {
    return capitalize(clipWords(t.includes('?') ? t : `${t}?`, 18))
  }

  if (/^tell me\b/i.test(t)) {
    return capitalize(clipWords(t.includes('?') ? t : `${t.replace(/[.]+$/, '')}?`, 18))
  }

  // Imperative / action → keep the specific check, add report-back
  if (!/\b(tell me|what do you|what did you|what do you find|what do you see|what do you get)\b/i.test(t)) {
    const closer = /\b(pressure|gauge|volt|ohm|psi|reading)\b/i.test(t)
      ? '— what do you get?'
      : '— what do you find?'
    t = `${t.replace(/[.]+$/, '')} ${closer}`
  }

  return capitalize(clipWords(t, 18))
}

/** Build the short tile headline — always names the check when possible. */
export function shortenNextStepText(body: string): string {
  const topic = detectTopic(body)

  // Gathering / fork questions — keep a clear ask if Gus already wrote one
  if (
    topic === 'symptom' ||
    topic === 'make' ||
    topic === 'vibration' ||
    topic === 'hydraulics_which'
  ) {
    const existing = sentencesOf(body).find(
      (s) =>
        (s.includes('?') || /^(which|what|when|where|how)\b/i.test(s)) &&
        !isVagueNextStep(s) &&
        s.length >= 12,
    )
    if (existing) return capitalize(clipWords(existing, 18))
    return TOPIC_FALLBACK_ASK[topic] ?? "What's it doing wrong?"
  }

  if (isVagueNextStep(body)) {
    return TOPIC_FALLBACK_ASK[topic] ?? TOPIC_FALLBACK_ASK.symptom ?? "What's it doing wrong?"
  }

  const specific = extractSpecificAction(body)

  if (specific && !isSymptomAsk(specific)) {
    const directed = withReportBack(specific)
    if (directed && !/\bdo this check\b/i.test(directed) && !/\bcheck that\b/i.test(directed)) {
      return directed
    }
  }

  const fallback = TOPIC_FALLBACK_ASK[topic]
  if (fallback) return fallback

  const opener = sentencesOf(body).find(
    (s) =>
      s.length >= 16 &&
      !/\bdo this check\b/i.test(s) &&
      !isFiller(s) &&
      !isDisclaimer(s) &&
      !isSymptomAsk(s),
  )
  if (opener) {
    const directed = withReportBack(opener)
    if (directed) return directed
  }

  return 'Check what Gus described in the how-to — what do you find?'
}

/** Fuller how-to text for the expand control — only for physical checks. */
export function nextStepHowTo(body: string, headline: string): string | null {
  const topic = detectTopic(body)
  if (
    topic === 'symptom' ||
    topic === 'make' ||
    topic === 'duration' ||
    topic === 'yesno' ||
    topic === 'cold_warm' ||
    topic === 'load' ||
    topic === 'smell' ||
    topic === 'photo' ||
    topic === 'vibration' ||
    topic === 'hydraulics_which'
  ) {
    return null
  }

  const usable = stripDisclaimers(body)
  if (!usable) return null

  // Pure observation Q&A ("tell me if it drifts…") — no how-to expand
  if (/\b(tell me if|tell me whether|does it|did it)\b/i.test(usable) && !/\b(gauge|multimeter|port|psi|ohm|volt)\b/i.test(usable)) {
    return null
  }

  if (/\bdrift\b/i.test(usable) || (/\brod\b/i.test(usable) && /\b(surface|scored)\b/i.test(usable))) {
    if (!/\b(gauge|multimeter|port|psi)\b/i.test(usable)) return null
  }

  if (!/\b(check|measure|test|gauge|multimeter|ohm|volt|port|pressure|unplug|inspect|probe|read )\b/i.test(usable)) {
    return null
  }

  const full = usable
    .split('\n')
    .map((l) => clean(l.replace(/^(?:[-*•▪︎]|\d+[.)])\s+/, '')))
    .filter(Boolean)
    .join('\n')

  if (!full) return null

  const compactFull = clean(full)
  const compactHead = clean(headline)
  if (compactFull.length < compactHead.length + 40 && !full.includes('\n') && full.split('.').length < 3) {
    return null
  }
  if (compactFull.toLowerCase() === compactHead.toLowerCase()) return null

  return full
}

function parseArrowPipes(raw: string): NextStepAnswers | null {
  const arrowMatch = raw.match(/(?:→|->)/)
  if (!arrowMatch || arrowMatch.index == null) return null

  const left = raw.slice(0, arrowMatch.index)
  const right = raw.slice(arrowMatch.index + arrowMatch[0].length)

  // Prefer the first line that actually has piped choices (ignore how-to after)
  const lines = right
    .split('\n')
    .map((l) => clean(l))
    .filter(Boolean)
  const pipedLine =
    lines.find((l) => l.includes('|')) ??
    lines.find((l) => /^(?:[-*•▪︎]|\d+[.)])/.test(l) === false && l.split(/\s+or\s+/i).length >= 3) ??
    lines[0]
  if (!pipedLine) return null

  let labels = pipedLine
    .split(/\s*\|\s*/)
    .map((s) => clean(s.replace(/^(?:[-*•▪︎]|\d+[.)])\s+/, '')))
    .filter(Boolean)

  // Gus sometimes uses commas instead of pipes on the chip line
  if (labels.length < 2 && /,/.test(pipedLine) && pipedLine.length < 120) {
    labels = pipedLine
      .split(/\s*,\s*/)
      .map((s) => clean(s))
      .filter((s) => s && s.length <= 40)
  }

  labels = labels.filter((l) => !isDisclaimer(l) && !/^how do i\b/i.test(l))
  if (labels.length < 2) return null

  // Question = last clear ask line before the arrow (ignore how-to above)
  const leftLines = left
    .split('\n')
    .map((l) => clean(l))
    .filter(Boolean)
  const askLine =
    [...leftLines].reverse().find((l) => /\?/.test(l) || /^(tell me|check|which|what|when|where|how)\b/i.test(l)) ??
    leftLines[0] ??
    ''

  const question = withReportBack(askLine.replace(/[:：]\s*$/, '') || shortenNextStepText(raw))
  return {
    question,
    howTo: nextStepHowTo(raw, question),
    answers: toChips(labels, question),
  }
}

function parseQuestionWithBullets(raw: string): NextStepAnswers | null {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return null

  const qIdx = lines.findIndex((l) => /\?\s*$/.test(l) || /\?\s*(?:→|->)/.test(l))
  if (qIdx < 0) return null

  const question = withReportBack(clean(lines[qIdx]!.replace(/\s*(?:→|->).*$/, '')))
  const bullets = lines
    .slice(qIdx + 1)
    .map((l) => l.replace(/^(?:[-*•▪︎]|\d+[.)])\s+/, '').trim())
    .filter((l) => l && !/\?\s*$/.test(l) && l.length <= 40)

  if (bullets.length < 2) return null
  return {
    question,
    howTo: nextStepHowTo(raw, question),
    answers: toChips(bullets, question),
  }
}

function extractClearAsk(body: string): string | null {
  const lines = sentencesOf(body)
  const ask = lines.find(
    (s) =>
      (/^(tell me|which|what|when|where|how|did |does |is |are )\b/i.test(s) || s.includes('?')) &&
      !isVagueNextStep(s) &&
      s.length >= 12,
  )
  if (!ask) return null
  // Keep multi-part asks readable — don't cut mid-clause on phone
  return capitalize(clipWords(ask.replace(/\s*(?:→|->).*$/, ''), 36))
}

/**
 * Pull intentional "scored or clean" style choices — never scrape commentary
 * like "problem or just the drive circuit" or "bar/belt".
 */
function chipsFromAskChoices(ask: string): string[] | null {
  const t = clean(ask)
  // Narrative "tell me if… and whether…" asks — don't scrape mid-sentence "or"/"/"
  if (/\b(tell me if|tell me whether|whether the|whether you)\b/i.test(t)) return null

  const stop =
    /^(and|the|or|a|an|is|are|does|did|what|when|how|feel|sound|look|looks|like|it|this|that|main|more|just|only|problem|circuit|system|drive|loader|tracks?|seat|bar|belt|engaged|alone|tells|wide|whole)$/i
  const choices: string[] = []

  // Only allow known diagnostic option pairs
  const allowPair = (a: string, b: string) => {
    const pair = `${a} ${b}`.toLowerCase()
    return (
      /\b(scored|clean|pitted|wet|dry|full|low|cold|warm|hot|good|bad|high|ok)\b/.test(pair) ||
      /\b(yes|no)\b/.test(pair)
    )
  }

  const orPairs = [
    ...t.matchAll(/\b([A-Za-z][A-Za-z0-9'-]{2,20})\s+or\s+([A-Za-z][A-Za-z0-9'-]{2,20})\b/gi),
  ]
  for (const m of orPairs) {
    const a = clean(m[1] ?? '')
    const b = clean(m[2] ?? '')
    if (!a || !b || stop.test(a) || stop.test(b)) continue
    if (/\s/.test(a) || /\s/.test(b)) continue
    if (!allowPair(a, b)) continue
    choices.push(capitalize(a), capitalize(b))
  }

  const slash = t.match(/\b([A-Za-z][A-Za-z0-9'-]{2,16})\s*\/\s*([A-Za-z][A-Za-z0-9'-]{2,16})\b/)
  if (
    slash?.[1] &&
    slash[2] &&
    !stop.test(slash[1]) &&
    !stop.test(slash[2]) &&
    allowPair(slash[1], slash[2])
  ) {
    choices.push(capitalize(slash[1]), capitalize(slash[2]))
  }

  const uniq = [...new Set(choices.map((c) => c.toLowerCase()))].map(
    (key) => choices.find((c) => c.toLowerCase() === key)!,
  )
  if (uniq.length >= 2) {
    return [...uniq.slice(0, 3), 'Not sure']
  }
  return null
}

/**
 * No-travel / drive vs loader + seat-bar / safety interlock asks.
 */
function chipsForTravelSafetyAsk(ask: string): string[] | null {
  const t = clean(ask).toLowerCase()
  const hasTravel =
    /\b(travel|tracks?|drive|won't drive|no travel|propel)\b/.test(t) ||
    (/\btracks?\b/.test(t) && /\b(don'?t|doesn'?t|won'?t|work)\b/.test(t))
  const hasLoader =
    /\b(loader|bucket|lift|aux|boom|arm|hydraulics? work)\b/.test(t) ||
    (/\bhydraulics?\b/.test(t) && /\b(work|working|function)\b/.test(t))
  const hasSeatBar =
    /\b(seat bar|seatbelt|seat belt|lap bar|safety bar|arm bar|restraint)\b/.test(t) ||
    (/\b(bar|belt)\b/.test(t) && /\b(seat|engaged|down)\b/.test(t))

  if (!hasTravel && !hasLoader && !hasSeatBar) return null
  // Need travel/drive context or seat-bar alone as safety check
  if (!hasTravel && !hasSeatBar) return null

  const chips: string[] = []
  if (hasLoader && hasTravel) {
    chips.push('Loader works, no travel', 'Nothing works', 'Travel works too')
  } else if (hasTravel) {
    chips.push('No travel at all', 'Travel is weak / slow', 'Travel works now')
  }
  if (hasSeatBar) {
    chips.push('Seat bar / belt on', 'Seat bar / belt off')
  }
  chips.push('Not sure')
  return dedupeLabels(chips)
}

/**
 * Pull short option lists Gus already wrote in Summary ("spots: A, B, or C").
 */
function chipsFromProseOptions(text: string): string[] | null {
  const raw = clean(text)
  if (!raw || raw.length < 20) return null

  const chips: string[] = []

  // "usual spots: A, B, C, or D"
  const listAfterColon = raw.match(
    /(?:spots?|places?|options?|causes?|functions?|suspects?|candidates?|checks?)[:\s]+([^.!?\n]{12,160})/i,
  )
  if (listAfterColon?.[1]) {
    const parts = listAfterColon[1]
      .split(/\s*,\s*|\s+or\s+|\s*\/\s*|\s*;\s*/i)
      .map((p) =>
        clean(p)
          .replace(/^(the|a|an|at|on|from|to)\s+/i, '')
          .replace(/\s+(at the tank|area|side)$/i, ''),
      )
      .filter((p) => p.length >= 3 && p.length <= 36 && !isFiller(p) && !isDisclaimer(p))
    for (const p of parts) {
      if (!/^(and|the|with|from|that|this|when|once)$/i.test(p)) chips.push(capitalize(p))
    }
  }

  // Comma-separated noun phrases in one sentence mentioning "or"
  if (chips.length < 3) {
    const orList = raw.match(
      /\b([A-Za-z][A-Za-z0-9/ -]{2,28}),\s+([A-Za-z][A-Za-z0-9/ -]{2,28}),\s+(?:or\s+)?([A-Za-z][A-Za-z0-9/ -]{2,28})/i,
    )
    if (orList) {
      for (const i of [1, 2, 3]) {
        const p = clean(orList[i] ?? '')
          .replace(/^(the|a|an)\s+/i, '')
        if (p.length >= 3 && p.length <= 32) chips.push(capitalize(p))
      }
    }
  }

  const uniq = dedupeLabels(chips).slice(0, 6)
  if (uniq.length < 3) return null
  return [...uniq, 'Not sure', "I'll type it"]
}

/**
 * Last-resort chips that still answer common open asks — never lone "I'll type it".
 */
function fallbackChipsForOpenAsk(ask: string, contextExtra = ''): string[] {
  const t = clean(ask).toLowerCase()
  const kind = classifyAsk(ask)

  if (kind === 'where' || kind === 'which') {
    const fromProse = chipsFromProseOptions(`${ask}\n${contextExtra}`)
    if (fromProse) return fromProse
  }

  if (kind === 'where') {
    return chipsForLeakSourceAsk(ask, contextExtra) ?? [
      'Left side',
      'Right side',
      'Under the machine',
      'At a fitting / hose',
      'Not sure',
      "I'll type it",
    ]
  }

  if (kind === 'which') {
    return ['Boom / lift', 'Bucket / curl', 'Stick / arm', 'Travel', 'All of them', 'Not sure']
  }

  if (/\b(left|right|one side|both sides)\b/.test(t)) {
    return ['Left only', 'Right only', 'Both sides', 'Not sure']
  }

  if (/\b(intermittent|all the time|constant|come and go|every time)\b/.test(t)) {
    return ['All the time', 'Comes and goes', 'Only sometimes', 'Not sure']
  }

  if (/\b(getting worse|worse|same|better)\b/.test(t) && /\b(is it|has it|getting)\b/.test(t)) {
    return ['Getting worse', 'About the same', 'Getting better', 'Not sure']
  }

  if (/\b(after|recent|just (did|replaced|worked|serviced))\b/.test(t)) {
    return ['Yes — after recent work', 'No recent work', 'Not sure']
  }

  if (/\b(model|year|serial|hours)\b/.test(t)) {
    return ["I'll type the model", "I'll type hours / year", 'Not sure']
  }

  if (kind === 'feel') return TOPIC_CHIPS.vibration
  if (kind === 'when') return TOPIC_CHIPS.cold_warm
  if (kind === 'load') return TOPIC_CHIPS.load
  if (kind === 'pressure') return TOPIC_CHIPS.pressure
  if (kind === 'level') return TOPIC_CHIPS.level
  if (kind === 'duration') return TOPIC_CHIPS.duration
  if (kind === 'symptom') return TOPIC_CHIPS.symptom
  if (kind === 'make') return TOPIC_CHIPS.make

  if (/\b(photo|picture|pic|snap)\b/.test(t)) {
    return TOPIC_CHIPS.photo
  }

  if (kind === 'check') {
    // Prefer findings scraped from the ask ("scored or clean", "wet/dry")
    const fromChoices = chipsFromAskChoices(ask)
    if (fromChoices) return [...fromChoices, 'Not sure', "I'll type it"].filter(
      (c, i, a) => a.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i,
    )
    return ['Looks normal', 'Looks wrong / off', "Can't check yet", 'Not sure', "I'll type it"]
  }

  if (kind === 'yesno') {
    return labeledBinaryChips(ask) ?? ['Yes', 'No', 'Partly / sometimes', 'Not sure', "I'll type it"]
  }

  // Open ask — still avoid lone Yes/No when we can name findings
  const openChoices = chipsFromAskChoices(ask)
  if (openChoices) {
    return [...openChoices, 'Not sure', "I'll type it"].filter(
      (c, i, a) => a.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i,
    )
  }
  return ['Looks normal', 'Looks wrong / off', 'Not sure', "I'll type it"]
}

function isTypeOnlyChipSet(labels: string[]): boolean {
  if (labels.length === 0) return true
  return labels.every((l) => {
    const k = clean(l).toLowerCase()
    return (
      k === "i'll type it" ||
      k === "i'll type more" ||
      k === 'not sure' ||
      k === "i'm not sure"
    )
  })
}

/**
 * Build chips from the actual Next Step question — never from a generic stock set
 * that doesn't answer that ask.
 */
function inferChipsFromAsk(ask: string, contextExtra = ''): string[] | null {
  const t = clean(ask).toLowerCase()

  // Symptom gathering — including "main symptom and when it started"
  if (isSymptomAsk(t) || (/\bsymptom\b/.test(t) && /\b(tell me|what|main)\b/.test(t))) {
    return TOPIC_CHIPS.symptom
  }

  if (isMakeAsk(t)) return TOPIC_CHIPS.make

  // Where is the leak? — before oil-level / severity chips
  const leakSource = chipsForLeakSourceAsk(ask, contextExtra)
  if (leakSource) return leakSource

  // Oil / foam / multi-condition / travel+safety — before junk "or" scrapers
  const oilFoam = chipsForOilFoamAsk(ask)
  if (oilFoam) return oilFoam
  const multiCond = chipsForMultiConditionAsk(ask)
  if (multiCond) return multiCond
  const travelSafety = chipsForTravelSafetyAsk(ask)
  if (travelSafety) return travelSafety

  // Domain chips BEFORE compound — so "sounds like and when…" doesn't become truncated combos
  if (/\bdrift/.test(t) && /\brod\b/.test(t)) {
    return ['Drifts', 'Holds / no drift', 'Rod scored or wet', 'Rod looks clean']
  }
  if (/\bdrift/.test(t)) {
    return ['Yes — it drifts', 'No — holds position', 'Only when hot', 'Not sure']
  }
  if (/\brod\b/.test(t) && /\b(surface|scored|pitted|chrome|wet|oil|look|clean|see|find|check)\b/.test(t)) {
    return ['Rod looks clean', 'Rod scored / pitted', 'Wet with oil', 'Not sure']
  }

  if (/\b(leak|seeping|wet|oil on)\b/.test(t) && /\b(cylinder|seal|hose|fitting)\b/.test(t)) {
    // Severity at a known spot — not "where is it?"
    if (!/\bwhere\b|\bcoming from\b/.test(t)) {
      return ['Dry / no leak', 'Seeping', 'Active drip', 'Not sure']
    }
  }

  if (/\b(up or down|going up|going down|raise or lower|lifting or lowering)\b/.test(t)) {
    if (/\b(high idle|low idle|rpm)\b/.test(t)) {
      return ['Worse going up', 'Worse going down', 'Worse at high idle', 'Same either way']
    }
    return ['Worse going up', 'Worse going down', 'Same either way', 'Not sure']
  }

  if (
    /\b(what does|feel|sound like|feel like|rattl|knock|character)\b/.test(t) &&
    /\b(vibrat|noise|shake)/.test(t)
  ) {
    return TOPIC_CHIPS.vibration
  }

  if (/\b(when|where).*(vibrat|shake|noise)|does (the )?vibrat|does (it )?shake\b/.test(t)) {
    return ['At idle', 'Under load / working', 'Only when traveling', 'All the time']
  }

  if (/\b(high idle|low idle|rpm|rev)\b/.test(t) && /\b(shake|vibrat|noise|worse|more)/.test(t)) {
    return ['Worse at high idle', 'Worse at low idle', 'Same at any RPM', 'Not sure']
  }

  if (/\b(which function|feel weak|feel slow|are weak|which hydraulics)\b/.test(t)) {
    return TOPIC_CHIPS.hydraulics_which
  }

  // Compound observation forks (fan+click, etc.) — only after domain matches miss
  if (isCompoundObservationAsk(t)) {
    const compound = chipsFromCompoundAsk(ask)
    if (compound) return compound
  }

  if (/\b(cold|warm|hot)\b/.test(t) && /\b(worse|when|rough)\b/.test(t)) {
    return TOPIC_CHIPS.cold_warm
  }

  if (/\b(smoke|exhaust|stack)\b/.test(t) && /\b(color|what|see)\b/.test(t)) {
    return TOPIC_CHIPS.smoke
  }

  if (/\b(pressure|gauge|test port|psi)\b/.test(t)) {
    return TOPIC_CHIPS.pressure
  }

  if (/\b(sight glass|fluid level|oil level|between the marks)\b/.test(t)) {
    // Prefer foam-aware set when foam mentioned; else plain level
    return chipsForOilFoamAsk(ask) ?? TOPIC_CHIPS.level
  }

  if (/\b(volt|voltage|12\s*v)\b/.test(t)) return TOPIC_CHIPS.voltage
  if (/\b(ohm|resistance)\b/.test(t)) return TOPIC_CHIPS.ohms
  if (/\b(relay|getting power|energiz)\b/.test(t)) return TOPIC_CHIPS.relay
  if (/\b(wait.?to.?start|glow.?plug light|dash light)\b/.test(t)) return TOPIC_CHIPS.light
  if (/\b(smell|odor|raw fuel)\b/.test(t)) return TOPIC_CHIPS.smell
  if (/\b(photo|picture|snap a )\b/.test(t)) return TOPIC_CHIPS.photo
  if (/\b(icp|scan tool)\b/.test(t)) return TOPIC_CHIPS.scan

  // Duration ONLY when the ask is about time (and not also a symptom ask)
  if (
    /\b(how long|when (did|it) start|when it started|just start|been happening|how long has)\b/.test(
      t,
    )
  ) {
    return TOPIC_CHIPS.duration
  }

  if (/\b(under load|at idle|idle vs)\b/.test(t) && !/\b(shake|vibrat|drift)\b/.test(t)) {
    return TOPIC_CHIPS.load
  }

  // Last structural pass: "scored or clean", "full / low" spelled in the ask
  const fromChoices = chipsFromAskChoices(ask)
  if (fromChoices) return fromChoices

  // Single binary — prefer labeled answers over bare Yes/No
  if (isBinaryAsk(t)) {
    return labeledBinaryChips(ask) ?? ['Yes', 'No', 'Not sure', "I'll type more"]
  }

  // Options Gus already listed in Summary — only for where/which asks
  const askKind = classifyAsk(ask)
  if (askKind === 'where' || askKind === 'which') {
    const fromProse = chipsFromProseOptions(`${ask}\n${contextExtra}`)
    if (fromProse) return fromProse
  }

  return null
}

/** Generic Yes/No tiles that do not answer a non-binary ask. */
function isUselessGenericChipSet(labels: string[]): boolean {
  const keys = labels.map((l) => clean(l).toLowerCase())
  const generic = new Set(['yes', 'no', 'not sure', "i'll type it", "i'll type more", "i'm not sure"])
  return keys.length >= 2 && keys.every((k) => generic.has(k))
}

/** True when piped chips omit a dimension the ask clearly requested. */
function chipsMissAskDimensions(ask: string, labels: string[]): boolean {
  const t = clean(ask).toLowerCase()
  const joined = labels.map((l) => clean(l).toLowerCase()).join(' | ')

  const askOilFoam =
    (/\boil\b/.test(t) && /\b(level|full|low)\b/.test(t)) ||
    /\b(foam|foamy|aerat|sight glass)\b/.test(t)
  if (askOilFoam) {
    const chipsCoverOilFoam =
      /\b(oil|foam|foamy|aerat|sight)\b/.test(joined) ||
      /\b(full|looks full|looks low|oil low|oil full)\b/.test(joined)
    if (!chipsCoverOilFoam) return true
  }

  const askCel = /\b(check engine|cel\b|mil\b|service engine|fault light)\b/.test(t)
  if (askCel && !/\b(cel|check engine|light on|no cel|mil)\b/.test(joined)) return true

  const askLoad =
    /\b(idle vs|vs driving|idle or driv)\b/.test(t) ||
    (/\bidle\b/.test(t) && /\b(driv|driving|load)\b/.test(t))
  if (
    askLoad &&
    !/\b(idle|driv|driving|under load|at idle|rough at|rough while)\b/.test(joined)
  ) {
    return true
  }

  return false
}

/** What kind of answer the ask is looking for. */
type AskKind =
  | 'where'
  | 'which'
  | 'yesno'
  | 'when'
  | 'feel'
  | 'pressure'
  | 'level'
  | 'check'
  | 'symptom'
  | 'make'
  | 'duration'
  | 'load'
  | 'open'

function classifyAsk(ask: string): AskKind {
  const t = clean(ask).toLowerCase()
  if (isSymptomAsk(t)) return 'symptom'
  if (isMakeAsk(t)) return 'make'
  if (
    /\bwhere\b|\bcoming from\b|\bwhich (spot|place|hose|cylinder|seal|side|end)\b/.test(t) ||
    /\b(source of|pin down the source)\b/.test(t)
  ) {
    return 'where'
  }
  if (/\bwhich (function|circuit|end|cylinder|boom|bucket|stick|arm|hydraulics)\b/.test(t)) {
    return 'which'
  }
  // Voltage / ohms BEFORE pressure — "what do you get?" is shared wording
  if (/\b(volt|voltage|12\s*v)\b/.test(t)) return 'check'
  if (/\b(ohm|ohms|resistance)\b/.test(t)) return 'check'
  if (
    /\b(pressure|test port|psi|deadhead|relief pressure|charge pressure)\b/.test(t) ||
    (/\bgauge\b/.test(t) && /\b(pressure|port|hydraulic|psi)\b/.test(t))
  ) {
    return 'pressure'
  }
  if (/\b(sight glass|fluid level|oil level|between the marks|foam)\b/.test(t)) return 'level'
  if (/\b(how long|when (did|it) start|been happening)\b/.test(t)) return 'duration'
  if (/\b(cold|warm|hot)\b/.test(t) && /\b(worse|when|rough)\b/.test(t)) return 'when'
  if (/\b(under load|at idle|idle vs)\b/.test(t)) return 'load'
  if (
    /\b(what does|feel|sound like|feel like)\b/.test(t) ||
    (/\b(vibrat|noise|shake)\b/.test(t) && /\b(what|how|feel|sound)\b/.test(t))
  ) {
    return 'feel'
  }
  if (/\b(check|look|inspect|watch|what do you (find|see)|tell me what you)\b/.test(t)) {
    return 'check'
  }
  if (isBinaryAsk(t)) return 'yesno'
  return 'open'
}

/** Rough kind of a chip set — used to reject mismatched stock/piped answers. */
function classifyChipSet(labels: string[]): AskKind | 'mixed' {
  const joined = labels.map((l) => clean(l).toLowerCase()).join(' | ')
  const scores: Partial<Record<AskKind, number>> = {}
  const bump = (k: AskKind, n = 1) => {
    scores[k] = (scores[k] ?? 0) + n
  }

  if (/\b(weak|won'?t start|won'?t travel|noise or vibration|hard start)\b/.test(joined)) bump('symptom', 3)
  if (/\b(seal|hose|fitting|pump shaft|valve|tank|return|left side|right side|under the)\b/.test(joined)) {
    bump('where', 3)
  }
  if (/\b(lift \/ boom|travel only|swing only|all functions|bucket \/ curl)\b/.test(joined)) bump('which', 3)
  if (/\b(at \/ near spec|below spec|psi|can'?t get a reading)\b/.test(joined)) bump('pressure', 3)
  if (/\b(looks full|looks low|foamy|oil full|oil low)\b/.test(joined)) bump('level', 3)
  if (/\b(worse when cold|worse when warm|same either way)\b/.test(joined)) bump('when', 3)
  if (/\b(at idle|under load|both)\b/.test(joined) && !/\brough\b/.test(joined)) bump('load', 2)
  if (/\b(rattle|knocking|matches engine|only with hydraulics)\b/.test(joined)) bump('feel', 3)
  if (
    /\b(looks normal|looks wrong|can'?t check|dry \/ no leak|seeping|active drip|got voltage|no voltage|reading ok|reading bad|can'?t measure|has power|no power)\b/.test(
      joined,
    )
  ) {
    bump('check', 3)
  }
  // Standalone Yes/No chips only — don't treat "No voltage" as yesno
  {
    const keys = labels.map((l) => clean(l).toLowerCase())
    const yesNoish = keys.filter((k) =>
      /^(yes|no|yes —.*|no —.*|partly|partly \/ sometimes|drifts|holds|holds \/ no drift)$/i.test(k),
    )
    if (yesNoish.length >= 2) bump('yesno', 2)
    else if (yesNoish.length === 1 && keys.length <= 3) bump('yesno', 2)
  }
  if (/\b(just started|been a while|getting worse)\b/.test(joined)) bump('duration', 3)
  if (/\b(john deere|cat|komatsu)\b/.test(joined)) bump('make', 3)

  const ranked = (Object.entries(scores) as [AskKind, number][]).sort((a, b) => b[1] - a[1])
  if (!ranked.length || (ranked[0]?.[1] ?? 0) < 2) return 'mixed'
  if (ranked.length >= 2 && (ranked[1]?.[1] ?? 0) >= (ranked[0]?.[1] ?? 0) - 0) {
    // Two strong kinds → treat as mixed (Gus may have been creative)
    if ((ranked[1]?.[1] ?? 0) >= 3 && ranked[0]![0] !== ranked[1]![0]) return 'mixed'
  }
  return ranked[0]![0]
}

/** Reject chip sets that clearly answer a different question than the Next Step. */
function chipsMatchAsk(ask: string, labels: string[]): boolean {
  if (labels.length < 2) return false
  if (isTypeOnlyChipSet(labels)) return false

  const askKind = classifyAsk(ask)
  const chipKind = classifyChipSet(labels)
  if (chipKind === 'mixed' || askKind === 'open') return true

  // Compatible pairs
  if (askKind === chipKind) return true
  if (askKind === 'check' && (chipKind === 'yesno' || chipKind === 'level' || chipKind === 'where')) {
    return true
  }
  if (askKind === 'yesno' && chipKind === 'check') return true
  if (askKind === 'when' && chipKind === 'load') return true
  if (askKind === 'feel' && chipKind === 'load') return true

  // Hard mismatches — chips that answer a different fork than the Next Step
  const hard: Array<[AskKind, AskKind]> = [
    ['where', 'symptom'],
    ['where', 'feel'],
    ['where', 'pressure'],
    ['where', 'yesno'],
    ['where', 'level'],
    ['where', 'which'],
    ['which', 'symptom'],
    ['which', 'yesno'],
    ['which', 'where'],
    ['pressure', 'symptom'],
    ['pressure', 'where'],
    ['pressure', 'yesno'],
    ['pressure', 'feel'],
    ['pressure', 'check'],
    ['level', 'symptom'],
    ['level', 'where'],
    ['level', 'feel'],
    ['symptom', 'where'],
    ['symptom', 'pressure'],
    ['symptom', 'check'],
    ['symptom', 'level'],
    ['yesno', 'symptom'],
    ['yesno', 'where'],
    ['yesno', 'pressure'],
    ['duration', 'symptom'],
    ['make', 'symptom'],
    ['make', 'check'],
    ['feel', 'symptom'],
    ['feel', 'where'],
    ['feel', 'pressure'],
    ['check', 'symptom'],
    ['check', 'make'],
    ['check', 'feel'],
    ['check', 'duration'],
    ['check', 'pressure'],
    ['load', 'symptom'],
    ['load', 'where'],
  ]
  return !hard.some(([a, c]) => askKind === a && chipKind === c)
}

function shouldAcceptPipedChips(askBlob: string, labels: string[]): boolean {
  if (labels.length < 2) return false
  const allowBareYesNo = isBinaryAsk(askBlob) && !isCompoundObservationAsk(askBlob)
  if (isUselessGenericChipSet(labels) && !allowBareYesNo) return false
  if (chipsMissAskDimensions(askBlob, labels)) return false
  if (!chipsMatchAsk(askBlob, labels)) return false
  return true
}

function pickQuestionAndChips(
  nextBody: string,
  contextExtra = '',
): { question: string; chips: string[] } {
  const clearAsk = extractClearAsk(nextBody)
  const question = isVagueNextStep(nextBody)
    ? TOPIC_FALLBACK_ASK[detectTopic(`${contextExtra}\n${nextBody}`)] ??
      TOPIC_FALLBACK_ASK.symptom!
    : clearAsk ?? shortenNextStepText(nextBody)

  // Infer from the SHORT ask first — don't let how-to / Summary steal the topic
  const askForChips = question
  const fromAsk = inferChipsFromAsk(askForChips, contextExtra)
  if (fromAsk && chipsMatchAsk(askForChips, fromAsk)) {
    return { question, chips: fromAsk }
  }

  const topic = detectTopic(askForChips)
  if (topic !== 'check' && TOPIC_CHIPS[topic]) {
    const chips = TOPIC_CHIPS[topic]
    if (chipsMatchAsk(askForChips, chips)) {
      return { question, chips }
    }
  }

  if (isVagueNextStep(nextBody)) {
    const ctxTopic = detectTopic(`${contextExtra}\n${nextBody}`)
    if (ctxTopic !== 'check' && ctxTopic !== 'yesno' && TOPIC_CHIPS[ctxTopic]) {
      return {
        question: TOPIC_FALLBACK_ASK[ctxTopic] ?? question,
        chips: TOPIC_CHIPS[ctxTopic],
      }
    }
    return {
      question: TOPIC_FALLBACK_ASK.symptom!,
      chips: TOPIC_CHIPS.symptom,
    }
  }

  const fallback = fallbackChipsForOpenAsk(askForChips, contextExtra)
  if (chipsMatchAsk(askForChips, fallback)) {
    return { question, chips: fallback }
  }

  // Absolute last resort — finding-style, not a lone "I'll type it"
  return {
    question,
    chips: ['Looks normal', 'Looks wrong / off', 'Not sure', "I'll type it"],
  }
}

export function buildNextStepAnswers(
  nextBody: string | undefined,
  checkItems: string[] = [],
  /** Summary / rest of the reply — used so chips match the symptom when Next Step is vague. */
  contextExtra = '',
): NextStepAnswers | null {
  if (nextBody?.trim()) {
    // Parse Gus's → chips from the RAW body first (before any cleanup that
    // might touch the ask line). Then strip disclaimers for display/inference.
    const fromArrowRaw = parseArrowPipes(nextBody)
    const cleanedBody = stripDisclaimers(nextBody)
    if (!cleanedBody && !fromArrowRaw) {
      return null
    }

    const fromArrow = fromArrowRaw ?? (cleanedBody ? parseArrowPipes(cleanedBody) : null)
    if (fromArrow) {
      const cleaned = fromArrow.answers.map((a) => a.label).filter((l) => !isBannedChip(l))
      const askBlob = fromArrow.question
      if (shouldAcceptPipedChips(askBlob, cleaned)) {
        const question =
          isDisclaimer(fromArrow.question) || !isUsableNextStepQuestion(fromArrow.question)
            ? shortenNextStepText(cleanedBody || nextBody)
            : fromArrow.question
        if (!isUsableNextStepQuestion(question)) return null
        return {
          question,
          howTo: nextStepHowTo(cleanedBody || nextBody, question),
          answers: toChips(cleaned, question),
        }
      }
      // Piped chips mismatched the ask — invent chips that answer the question
      const inferred = pickQuestionAndChips(cleanedBody || nextBody, contextExtra)
      if (!isUsableNextStepQuestion(inferred.question)) return null
      return {
        question: inferred.question,
        howTo: nextStepHowTo(cleanedBody || nextBody, inferred.question),
        answers: toChips(inferred.chips, inferred.question),
      }
    }

    if (!cleanedBody) return null

    const fromBullets = parseQuestionWithBullets(cleanedBody)
    if (fromBullets) {
      const cleaned = fromBullets.answers.map((a) => a.label).filter((l) => !isBannedChip(l))
      const askBlob = fromBullets.question
      if (
        shouldAcceptPipedChips(askBlob, cleaned) &&
        isUsableNextStepQuestion(fromBullets.question)
      ) {
        return {
          ...fromBullets,
          howTo: nextStepHowTo(cleanedBody, fromBullets.question),
          answers: toChips(cleaned, fromBullets.question),
        }
      }
    }

    const inferred = pickQuestionAndChips(cleanedBody, contextExtra)
    if (!isUsableNextStepQuestion(inferred.question)) return null
    return {
      question: inferred.question,
      howTo: nextStepHowTo(cleanedBody, inferred.question),
      answers: toChips(inferred.chips, inferred.question),
    }
  }

  // Legacy Things to Check
  for (const item of checkItems) {
    const fromArrow = parseArrowPipes(item)
    if (fromArrow) {
      const cleaned = fromArrow.answers.map((a) => a.label).filter((l) => !isBannedChip(l))
      if (cleaned.length >= 2) {
        return { ...fromArrow, answers: toChips(cleaned, fromArrow.question) }
      }
    }
  }

  const questionOnly = checkItems.find((i) => /\?\s*$/.test(clean(i)))
  const shortAnswers = checkItems
    .map((i) => clean(i))
    .filter((i) => i && !/\?\s*$/.test(i) && !/(?:→|->)/.test(i) && i.length <= 40 && !isBannedChip(i))
    .slice(0, 4)

  if (questionOnly && shortAnswers.length >= 2) {
    const question = withReportBack(clean(questionOnly))
    return {
      question,
      howTo: null,
      answers: toChips(shortAnswers, question),
    }
  }

  return null
}

export function nextStepDisplayText(body: string, answerBlock: NextStepAnswers | null): string {
  if (answerBlock?.question) return answerBlock.question
  return shortenNextStepText(body)
}
