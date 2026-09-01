/** Inbox for App Store support — not shown as plain text on public pages. */
export const SUPPORT_EMAIL = 'gid.osborn@gmail.com'

/** mailto: link for support buttons (Apple requires a way to contact you). */
export function supportMailtoUrl(subject = 'IronMedic Support'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}
