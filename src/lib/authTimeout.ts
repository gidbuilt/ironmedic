const DEFAULT_MS = 30_000

export function withAuthTimeout<T>(
  promise: Promise<T>,
  message = 'Request timed out. Check your connection and try again.',
  ms = DEFAULT_MS,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}
