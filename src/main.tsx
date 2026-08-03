import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'

async function initNativeChrome() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#08090b' })
    // Draw under the status bar; CSS safe-area insets keep content clear.
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch {
    // StatusBar is iOS/Android only.
  }
  try {
    await SplashScreen.hide()
  } catch {
    // Splash plugin may be unavailable in some builds — ignore.
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

void initNativeChrome()
