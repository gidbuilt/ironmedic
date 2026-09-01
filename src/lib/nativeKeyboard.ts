import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'

const KEYBOARD_INSET_VAR = '--keyboard-inset'

function setKeyboardInset(px: number) {
  const value = Math.max(0, Math.round(px))
  document.documentElement.style.setProperty(KEYBOARD_INSET_VAR, `${value}px`)
  document.documentElement.dataset.keyboard = value > 0 ? 'open' : 'closed'
}

/**
 * Keeps chat composers above the soft keyboard on iOS Capacitor (and
 * mobile Safari via visualViewport). Layouts should pad/shrink using
 * `var(--keyboard-inset)`.
 */
export async function initNativeKeyboard() {
  setKeyboardInset(0)

  if (Capacitor.isNativePlatform()) {
    try {
      // Manual inset handling — body/dvh resize is unreliable with fixed chat shells.
      await Keyboard.setResizeMode({ mode: KeyboardResize.None })
    } catch {
      // Older plugin builds may not support setResizeMode.
    }

    await Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardInset(info.keyboardHeight)
    })
    await Keyboard.addListener('keyboardDidShow', (info) => {
      setKeyboardInset(info.keyboardHeight)
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    })
    await Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardInset(0)
    })
    await Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardInset(0)
    })
    return
  }

  const vv = window.visualViewport
  if (!vv) return

  const update = () => {
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    setKeyboardInset(inset)
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
}
