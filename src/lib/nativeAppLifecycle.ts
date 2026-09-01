import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

type ResumeHandler = () => void | Promise<void>

/**
 * Soft session refresh when the app returns from background (screen lock, home).
 * Does not interrupt in-flight Gus streams.
 */
export async function initNativeAppLifecycle(onResume: ResumeHandler) {
  if (!Capacitor.isNativePlatform()) {
    const onVis = () => {
      if (document.visibilityState === 'visible') void onResume()
    }
    document.addEventListener('visibilitychange', onVis)
    return
  }

  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void onResume()
  })
}
