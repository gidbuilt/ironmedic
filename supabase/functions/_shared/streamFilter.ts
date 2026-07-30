import type { DiagnosticStage } from './parseResponse.ts'

/**
 * Stateful filter applied to live text deltas as they arrive from Claude,
 * so the user only ever sees clean prose while streaming:
 * 1. Withholds text until the leading `STAGE:<name>` marker line is
 *    complete, then strips it (captured separately, never shown).
 * 2. Once a fenced ```diagnosis-json / ```verify-fix-json block starts
 *    (always the last thing in a reply, per the system prompt's protocol),
 *    stops forwarding further text — the client gets the authoritative
 *    parsed result via the final "done" event instead.
 *
 * This is a best-effort *display* filter only. The final event re-parses
 * the full accumulated text with `parseModelResponse` for correctness, so
 * any edge case this filter mishandles never corrupts stored data — only,
 * at worst, the live-typing effect for that one reply.
 */
export class ResponseStreamFilter {
  stage: DiagnosticStage | null = null
  private stageStripped = false
  private preBuffer = ''
  private fenceDetected = false
  private holdBuffer = ''

  feed(chunk: string): string {
    let remaining = chunk

    if (!this.stageStripped) {
      this.preBuffer += remaining
      const nl = this.preBuffer.indexOf('\n')
      if (nl === -1) {
        // Same-line STAGE (no newline yet): strip as soon as the marker is complete.
        const sameLine = this.preBuffer.match(/^STAGE:\s*([a-z_]+)(?:\s+|$)/i)
        if (sameLine && (/\s/.test(this.preBuffer.slice(sameLine[0].length)) || this.preBuffer.length > sameLine[0].length)) {
          this.stage = sameLine[1].toLowerCase() as DiagnosticStage
          remaining = this.preBuffer.slice(sameLine[0].length).replace(/^\s+/, '')
          this.preBuffer = ''
          this.stageStripped = true
        } else if (this.preBuffer.length > 200) {
          // No marker showed up in a reasonable window — fail open rather
          // than swallow the whole reply.
          remaining = stripStageLines(this.preBuffer)
          this.preBuffer = ''
          this.stageStripped = true
        } else {
          return ''
        }
      } else {
        const firstLine = this.preBuffer.slice(0, nl)
        const m = firstLine.match(/^STAGE:\s*([a-z_]+)\s*/i)
        if (m) {
          this.stage = m[1].toLowerCase() as DiagnosticStage
          // Keep any prose that sat on the same line after the marker.
          const afterMarker = firstLine.slice(m[0].length).trimStart()
          remaining = (afterMarker ? afterMarker + '\n' : '') + this.preBuffer.slice(nl + 1)
        } else {
          remaining = this.preBuffer
        }
        this.preBuffer = ''
        this.stageStripped = true
      }
    }

    if (this.fenceDetected) return ''

    remaining = stripStageLines(remaining)

    const combined = this.holdBuffer + remaining
    const idx = combined.indexOf('```')
    if (idx !== -1) {
      this.fenceDetected = true
      this.holdBuffer = ''
      return stripStageLines(combined.slice(0, idx))
    }

    const sendLen = Math.max(0, combined.length - 3)
    this.holdBuffer = combined.slice(sendLen)
    return combined.slice(0, sendLen)
  }

  flush(): string {
    if (this.fenceDetected) return ''
    const out = stripStageLines(this.holdBuffer)
    this.holdBuffer = ''
    return out
  }
}

/** Drop any leftover STAGE marker lines so they never reach the chat UI. */
function stripStageLines(text: string): string {
  return text.replace(/^\s*STAGE:\s*[a-z_]+\s*$/gim, '').replace(/^\s*STAGE:\s*[a-z_]+\s+/gim, '')
}
