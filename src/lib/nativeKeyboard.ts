import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'

const KEYBOARD_INSET_VAR = '--keyboard-inset'

let capacitorInset = 0

function setKeyboardInset(px: number) {
  const value = Math.max(0, Math.round(px))
  document.documentElement.style.setProperty(KEYBOARD_INSET_VAR, `${value}px`)
  document.documentElement.dataset.keyboard = value > 0 ? 'open' : 'closed'
}

function visualViewportInset(): number {
  const vv = window.visualViewport
  if (!vv) return 0
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
}

function applyInset() {
  setKeyboardInset(Math.max(capacitorInset, visualViewportInset()))
}

function mountVisualViewportInset() {
  const vv = window.visualViewport
  if (!vv) return

  vv.addEventListener('resize', applyInset)
  vv.addEventListener('scroll', applyInset)
  applyInset()
}

/**
 * Keeps chat composers above the soft keyboard on iOS Capacitor (and
 * mobile Safari via visualViewport). Layouts pad/shrink using
 * `var(--keyboard-inset)` on `.im-app-shell` and `.im-layout-main`.
 */
export async function initNativeKeyboard() {
  capacitorInset = 0
  setKeyboardInset(0)

  if (Capacitor.isNativePlatform()) {
    try {
      // Manual inset — we shrink the app shell instead of letting WKWebView resize.
      await Keyboard.setResizeMode({ mode: KeyboardResize.None })
    } catch {
      // Older plugin builds may not support setResizeMode.
    }

    mountVisualViewportInset()

    await Keyboard.addListener('keyboardWillShow', (info) => {
      capacitorInset = info.keyboardHeight
      applyInset()
    })
    await Keyboard.addListener('keyboardDidShow', (info) => {
      capacitorInset = info.keyboardHeight
      applyInset()
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        requestAnimationFrame(() => {
          active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      }
    })
    await Keyboard.addListener('keyboardWillHide', () => {
      capacitorInset = 0
      applyInset()
    })
    await Keyboard.addListener('keyboardDidHide', () => {
      capacitorInset = 0
      applyInset()
    })
    return
  }

  mountVisualViewportInset()
}
