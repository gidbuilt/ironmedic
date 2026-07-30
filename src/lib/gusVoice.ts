/**
 * Gus's spoken voice — Azure Neural (Davis) via gus-speak.
 * Plays one full utterance per reply when the stream finishes.
 * Browser TTS is fallback only if Azure fails.
 */

import { supabase } from './supabase'

export const GUS_MUTE_STORAGE_KEY = 'ironmedic:gus-voice-muted'

type SpeakingListener = (speaking: boolean) => void
/** 0 = closed mouth / silence, 1 = fully open. */
type VisemeListener = (openness: number) => void

const speakingListeners = new Set<SpeakingListener>()
const visemeListeners = new Set<VisemeListener>()

let speaking = false
let currentAudio: HTMLAudioElement | null = null
let ampTimer: number | null = null
let audioCtx: AudioContext | null = null

/** Bumped to cancel in-flight fetch/play. */
let speechGeneration = 0
/** Bumped to resolve a hanging play promise when halted. */
let playSession = 0

function setSpeaking(next: boolean) {
  if (speaking === next) return
  speaking = next
  for (const fn of speakingListeners) fn(speaking)
  if (!next) emitViseme(0)
}

function emitViseme(openness: number) {
  const clamped = Math.max(0, Math.min(1, openness))
  for (const fn of visemeListeners) fn(clamped)
}

type MuteListener = (muted: boolean) => void
const muteListeners = new Set<MuteListener>()

export function isGusMuted(): boolean {
  return localStorage.getItem(GUS_MUTE_STORAGE_KEY) === '1'
}

export function setGusMuted(muted: boolean) {
  localStorage.setItem(GUS_MUTE_STORAGE_KEY, muted ? '1' : '0')
  for (const fn of muteListeners) fn(muted)
  if (muted) stopGusSpeech()
}

/** Sending a message means the user wants to hear Gus — clear mute. */
export function ensureGusUnmuted(): void {
  if (isGusMuted()) setGusMuted(false)
}

export function subscribeGusMuted(fn: MuteListener): () => void {
  muteListeners.add(fn)
  fn(isGusMuted())
  return () => muteListeners.delete(fn)
}

export function subscribeGusSpeaking(fn: SpeakingListener): () => void {
  speakingListeners.add(fn)
  fn(speaking)
  return () => speakingListeners.delete(fn)
}

export function subscribeGusViseme(fn: VisemeListener): () => void {
  visemeListeners.add(fn)
  fn(0)
  return () => visemeListeners.delete(fn)
}

export function isGusSpeaking(): boolean {
  return speaking
}

function haltPlayback() {
  playSession += 1
  if (ampTimer != null) {
    window.clearInterval(ampTimer)
    ampTimer = null
  }
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    try {
      currentAudio.pause()
    } catch {
      /* ignore */
    }
    currentAudio.src = ''
    currentAudio = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  setSpeaking(false)
}

export function stopGusSpeech() {
  speechGeneration += 1
  haltPlayback()
}

/** Call from a click handler (Send) so the browser allows audio later. */
export function unlockGusAudio(): void {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.01)
  } catch {
    /* ignore */
  }
  try {
    window.speechSynthesis?.getVoices()
  } catch {
    /* ignore */
  }
}

/** Warm the gus-speak Edge Function on Send so the reply synth is faster. */
export function warmGusSpeak(): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const base = import.meta.env.VITE_SUPABASE_URL
      if (!base) return
      await fetch(`${base}/functions/v1/gus-speak`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'Ok.' }),
      })
    } catch {
      /* ignore warm failures */
    }
  })()
}

export function textForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^STAGE:\s*\w+\s*/im, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(Likely|Confirm):\s*/gim, '')
    .replace(/^\s*[•\-*]\s+/gm, '')
    .replace(/\*\*?/g, '')
    // "(pass)/(fail)" / "yes/no" → say "or", never "slash"
    .replace(/\(([^)/]+)\)\s*\/\s*\(([^)/]+)\)/g, '$1 or $2')
    .replace(/\b([A-Za-z][A-Za-z0-9+\-]*)\s*\/\s*([A-Za-z][A-Za-z0-9+\-]*)\b/g, '$1 or $2')
    // Shorthand separators → sentence breaks so TTS doesn't rush fragments.
    .replace(/\s*[—–]\s*/g, '. ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim()
}

function pickBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const en = voices.filter((v) => /^en(-|_)/i.test(v.lang))
  const pool = en.length ? en : voices
  const preferred =
    pool.find((v) => /david|daniel|fred|alex|arthur|guy|davis|james|george|male/i.test(v.name)) ??
    pool.find((v) => !/female|zira|samantha|karen|moira|fiona|veena|tessa/i.test(v.name)) ??
    pool[0]
  return preferred ?? null
}

function speakWithWebSpeech(text: string, gen: number): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve()
  if (gen !== speechGeneration) return Promise.resolve()

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.96
    utter.pitch = 0.82
    const voice = pickBrowserVoice()
    if (voice) utter.voice = voice

    const finish = () => {
      if (ampTimer != null) {
        window.clearInterval(ampTimer)
        ampTimer = null
      }
      if (gen === speechGeneration) setSpeaking(false)
      resolve()
    }

    utter.onstart = () => {
      if (gen !== speechGeneration) {
        window.speechSynthesis.cancel()
        resolve()
        return
      }
      setSpeaking(true)
      ampTimer = window.setInterval(() => emitViseme(0.3 + Math.random() * 0.5), 120)
    }
    utter.onend = finish
    utter.onerror = finish
    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    } catch {
      finish()
    }
  })
}

async function fetchAzureAudio(text: string): Promise<{ url: string }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Not signed in')

  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) throw new Error('Missing VITE_SUPABASE_URL')

  const res = await fetch(`${base}/functions/v1/gus-speak`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`gus-speak failed: ${res.status} ${err}`)
  }

  const json = (await res.json()) as { audioBase64?: string; contentType?: string; error?: string }
  if (!json.audioBase64) throw new Error(json.error ?? 'No audio in response')

  const binary = atob(json.audioBase64)
  if (binary.length < 64) throw new Error('Azure returned empty audio')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: json.contentType ?? 'audio/mpeg' })
  return { url: URL.createObjectURL(blob) }
}

function playAudioUrl(url: string, gen: number): Promise<void> {
  const session = ++playSession
  return new Promise((resolve, reject) => {
    if (gen !== speechGeneration) {
      URL.revokeObjectURL(url)
      resolve()
      return
    }

    const audio = new Audio(url)
    currentAudio = audio

    const cleanup = () => {
      if (ampTimer != null) {
        window.clearInterval(ampTimer)
        ampTimer = null
      }
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
    }

    audio.onended = () => {
      cleanup()
      if (session === playSession && gen === speechGeneration) setSpeaking(false)
      resolve()
    }
    audio.onerror = () => {
      cleanup()
      if (session !== playSession || gen !== speechGeneration) {
        resolve()
        return
      }
      reject(new Error('Audio element failed to play'))
    }

    void audio.play().then(
      () => {
        if (session !== playSession || gen !== speechGeneration) {
          cleanup()
          resolve()
          return
        }
        // Only mark speaking once audio is actually playing.
        setSpeaking(true)
        ampTimer = window.setInterval(() => emitViseme(0.3 + Math.random() * 0.55), 100)
      },
      (err) => {
        cleanup()
        if (session !== playSession || gen !== speechGeneration) {
          resolve()
          return
        }
        reject(err)
      },
    )
  })
}

async function speakFullText(raw: string, gen: number): Promise<void> {
  let text = textForSpeech(raw)
  if (!text) return
  if (text.length > 900) text = text.slice(0, 900)
  if (gen !== speechGeneration) return

  try {
    const { url } = await fetchAzureAudio(text)
    if (gen !== speechGeneration) {
      URL.revokeObjectURL(url)
      return
    }
    await playAudioUrl(url, gen)
  } catch (err) {
    console.warn('[gusVoice] Azure unavailable, using browser voice', err)
    if (gen === speechGeneration) await speakWithWebSpeech(text, gen)
  }
}

/** Start a new streamed speaking turn (call on Send). */
export function beginGusSpeechTurn(): void {
  speechGeneration += 1
  haltPlayback()
  unlockGusAudio()
}

/**
 * Speaks the finished reply as one Azure clip. Prefetch was removed — it
 * revoked in-flight blobs and left Gus gesturing with no audio.
 */
export function createGusSpeechStreamer() {
  let active = false
  let gen = 0
  let played = false

  return {
    start() {
      beginGusSpeechTurn()
      active = true
      gen = speechGeneration
      played = false
    },
    feed(_buffer: string) {
      // Intentionally no mid-stream speak/prefetch — finish handles audio.
    },
    finish(buffer: string) {
      if (!active) return
      active = false
      if (isGusMuted() || played) return
      played = true

      const full = textForSpeech(buffer)
      if (!full) return
      const finishGen = gen
      if (finishGen !== speechGeneration) return

      void speakFullText(buffer, finishGen).catch((err) => {
        console.warn('[gusVoice] finish speak failed', err)
      })
    },
  }
}

/** @deprecated — kept for any one-shot callers. */
export function pushGusSpeechPhrase(raw: string): void {
  void speakFullText(raw, speechGeneration)
}

/**
 * Speak a full reply aloud (non-streaming). Prefers Azure Neural TTS;
 * falls back to the browser voice if that fails.
 */
export async function speakGusText(raw: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (isGusMuted()) return
  beginGusSpeechTurn()
  await speakFullText(raw, speechGeneration)
}
