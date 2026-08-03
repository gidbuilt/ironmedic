/**
 * Parse Gus reply text into UI sections for scannable chat rendering.
 * Prefers explicit ## headings; falls back to Likely:/Confirm: and prose.
 */

export type AssistantSectionKind = 'summary' | 'checks' | 'diagnosis' | 'next'

export type AssistantSection = {
  kind: AssistantSectionKind
  body?: string
  items?: string[]
}

const HEADING_RE =
  /^(?:#{1,3}\s*)?(summary|things to check|checks?|possible diagnosis|diagnosis|next step|next)\s*:?\s*$/i

function kindFromHeading(label: string): AssistantSectionKind | null {
  const t = label.trim().toLowerCase()
  if (t === 'summary') return 'summary'
  if (t === 'things to check' || t === 'check' || t === 'checks') return 'checks'
  if (t === 'possible diagnosis' || t === 'diagnosis') return 'diagnosis'
  if (t === 'next step' || t === 'next') return 'next'
  return null
}

function stripBullet(line: string): string {
  return line
    .replace(/^\s*(?:[-*•▪︎]|☐|\[\s?[xX ]?\s?\])\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .trim()
}

function isBulletLine(line: string): boolean {
  return /^\s*(?:[-*•▪︎]|☐|\[\s?[xX ]?\s?\]|\d+[.)])\s+/.test(line)
}

function collectListItems(block: string): string[] {
  const items: string[] = []
  for (const line of block.split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (isBulletLine(t) || items.length > 0) {
      const item = stripBullet(t)
      if (item) items.push(item)
    }
  }
  // If no bullets, treat non-empty lines as items when short enough
  if (items.length === 0) {
    for (const line of block.split('\n')) {
      const t = line.trim()
      if (t) items.push(t)
    }
  }
  return items
}

function parseLabeledSections(text: string): AssistantSection[] | null {
  const lines = text.split('\n')
  const sections: AssistantSection[] = []
  let currentKind: AssistantSectionKind | null = null
  let buf: string[] = []

  const flush = () => {
    if (!currentKind) return
    const block = buf.join('\n').trim()
    buf = []
    const kind = currentKind
    currentKind = null
    if (!block) return
    if (kind === 'checks' || kind === 'diagnosis') {
      const items = collectListItems(block)
      if (items.length > 0) sections.push({ kind, items })
    } else {
      sections.push({ kind, body: block })
    }
  }

  let sawHeading = false
  for (const line of lines) {
    const headingMatch = line.trim().match(HEADING_RE)
    if (headingMatch) {
      sawHeading = true
      flush()
      currentKind = kindFromHeading(headingMatch[1])
      continue
    }
    if (currentKind) buf.push(line)
  }
  flush()

  if (!sawHeading || sections.length === 0) return null
  return sections
}

function parseLegacyLikelyConfirm(text: string): AssistantSection[] | null {
  const likelyMatch = text.match(/^\s*Likely\s*:?\s*$/im)
  const confirmMatch = text.match(/^\s*Confirm\s*:?\s*$/im)
  if (!likelyMatch && !confirmMatch) return null

  const likelyIdx = likelyMatch?.index ?? -1
  const confirmIdx = confirmMatch?.index ?? -1
  const firstMarker = [likelyIdx, confirmIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0

  const sections: AssistantSection[] = []
  const summary = text.slice(0, firstMarker).trim()
  if (summary) sections.push({ kind: 'summary', body: summary })

  if (likelyIdx >= 0) {
    let block = text.slice(likelyIdx).replace(/^\s*Likely\s*:?\s*/im, '')
    if (confirmIdx > likelyIdx) {
      const cut = block.search(/^\s*Confirm\s*:?\s*$/im)
      if (cut >= 0) block = block.slice(0, cut)
    }
    const items = collectListItems(block)
    if (items.length) sections.push({ kind: 'diagnosis', items })
  }

  if (confirmIdx >= 0) {
    const block = text.slice(confirmIdx).replace(/^\s*Confirm\s*:?\s*/im, '')
    const items = collectListItems(block)
    if (items.length === 1) {
      sections.push({ kind: 'checks', items })
      sections.push({ kind: 'next', body: items[0] })
    } else if (items.length > 1) {
      sections.push({ kind: 'checks', items })
      sections.push({ kind: 'next', body: 'Run those checks and tell me what you find.' })
    } else if (block.trim()) {
      sections.push({ kind: 'next', body: block.trim() })
    }
  }

  return sections.length ? sections : null
}

function parseFallback(text: string): AssistantSection[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const lines = trimmed.split('\n')
  const questionLines = lines.filter((l) => {
    const t = l.trim()
    return Boolean(t) && (isBulletLine(t) || /^\d+[.)]/.test(t)) && (t.includes('?') || stripBullet(t).length > 12)
  })

  if (questionLines.length >= 2) {
    const firstQ = lines.findIndex((l) => questionLines.includes(l))
    const summary = lines.slice(0, Math.max(0, firstQ)).join('\n').trim()
    const items = questionLines.map(stripBullet).filter(Boolean)
    const sections: AssistantSection[] = []
    if (summary) sections.push({ kind: 'summary', body: summary })
    sections.push({ kind: 'checks', items })
    sections.push({ kind: 'next', body: 'Answer those and I will narrow it down.' })
    return sections
  }

  return [{ kind: 'summary', body: trimmed }]
}

export function parseAssistantMessage(raw: string): AssistantSection[] {
  const text = raw.trim()
  if (!text) return []
  return parseLabeledSections(text) ?? parseLegacyLikelyConfirm(text) ?? parseFallback(text)
}
