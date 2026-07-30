/**
 * Clean assistant text for on-screen chat. STAGE markers and fenced protocol
 * blocks are internal — never show them in the bubble.
 */
export function sanitizeAssistantDisplay(raw: string): string {
  return raw
    .replace(/^\s*STAGE:\s*[a-z_]+\s*/gim, '')
    .replace(/```(?:diagnosis-json|verify-fix-json|differential-json|machine-info-json)[\s\S]*?```/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
