import { Capacitor } from '@capacitor/core'

/** True only inside the native iOS Capacitor shell (not Safari / Android). */
export function isNativeIos(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}
