import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

/** Open Stripe Checkout / billing URLs — WebView blocks external navigation on iOS. */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'fullscreen' })
    return
  }
  window.location.assign(url)
}
