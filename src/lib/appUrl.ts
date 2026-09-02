import { Capacitor } from '@capacitor/core'

const DEFAULT_APP_URL = 'https://ironmedic.vercel.app'

/** Public app origin for auth redirects, Stripe return URLs, etc. */
export function getAppUrl(): string {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
    return window.location.origin
  }
  return DEFAULT_APP_URL
}

export function appPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getAppUrl()}${normalized}`
}
