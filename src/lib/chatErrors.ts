/** Network / WebKit errors that should not look like a hard app failure. */
export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false
  if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError') {
    return true
  }
  const message = err instanceof Error ? err.message : String(err)
  return /load failed|failed to fetch|networkerror|network request failed|aborted|the operation was aborted|the user aborted/i.test(
    message,
  )
}

export function friendlyChatError(err: unknown): string {
  if (isTransientNetworkError(err)) {
    return 'Connection paused. Tap Retry to continue.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong talking to Gus.'
}
