/** True for WebKit/Capacitor network drops (screen lock, background, offline). */
export function isTransientNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string }
  if (e.name === 'AbortError') return true
  const m = (e.message ?? '').toLowerCase()
  return (
    m.includes('load failed') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('the operation was aborted') ||
    m === 'aborted'
  )
}
