import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ironmedic.app',
  appName: 'IronMedic',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#08090b',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08090b',
    },
    Keyboard: {
      // App applies --keyboard-inset from Keyboard events (see nativeKeyboard.ts).
      resize: 'none',
    },
  },
}

export default config
