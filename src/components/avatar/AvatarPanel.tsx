import { useEffect, useState } from 'react'
import {
  GUS_MUTE_STORAGE_KEY,
  setGusMuted,
  stopGusSpeech,
  subscribeGusMuted,
  subscribeGusSpeaking,
} from '../../lib/gusVoice'
import { GusAvatarScene } from './GusAvatarScene'

type Size = 'hero' | 'side'

const sizeClass: Record<Size, string> = {
  hero: 'h-80 w-full max-w-lg sm:h-[26rem] md:h-[30rem]',
  side: 'h-56 w-full sm:h-72 md:h-80',
}

/**
 * 3D Gus (rigged GLB). Approaches + talks while TTS plays; agrees, then eases back.
 */
export function AvatarPanel({ speaking = false, size = 'side' }: { speaking?: boolean; size?: Size }) {
  const [muted, setMuted] = useState(false)
  const [voiceSpeaking, setVoiceSpeaking] = useState(false)

  useEffect(() => subscribeGusMuted(setMuted), [])
  useEffect(() => subscribeGusSpeaking(setVoiceSpeaking), [])

  const active = speaking || voiceSpeaking

  function toggleMuted() {
    const next = !muted
    setMuted(next)
    setGusMuted(next)
    if (next) stopGusSpeech()
  }

  const frameClass =
    size === 'hero' ? 'h-full min-h-[22rem] w-full flex-1' : `${sizeClass.side} w-full`

  return (
    <div className={`relative flex min-h-0 w-full flex-col ${size === 'hero' ? 'h-full' : ''}`}>
      <div className={`relative min-h-0 ${frameClass} ${size === 'hero' ? 'bg-transparent' : ''}`}>
        {/* Soft contact shadow under Gus */}
        {size === 'hero' && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 z-[2] -translate-x-1/2"
            style={{
              bottom: '8%',
              width: 'min(55%, 24rem)',
              height: '5rem',
              background:
                'radial-gradient(ellipse 58% 48% at 50% 40%, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 45%, transparent 75%)',
            }}
          />
        )}
        <GusAvatarScene speaking={active} className="relative z-[3] h-full w-full" />
      </div>
      <div
        className={`z-10 flex items-center gap-2 px-1 py-1 ${
          size === 'hero'
            ? 'absolute bottom-8 right-3 rounded-full border border-steel-700/80 bg-steel-950/70 px-2 backdrop-blur-sm'
            : 'mt-1 max-w-[14rem] justify-between self-center'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-tech-400 status-pulse' : 'bg-steel-600'}`} />
          <span className="text-xs font-medium text-steel-300">
            {voiceSpeaking ? 'Talking' : speaking ? 'Thinking…' : 'Gus'}
          </span>
        </span>
        <button
          type="button"
          onClick={toggleMuted}
          className="rounded-full px-1.5 py-0.5 text-xs text-steel-400 hover:text-steel-100"
          title={muted ? 'Unmute Gus' : 'Mute Gus'}
          aria-pressed={muted}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
      <span className="hidden" data-mute-key={GUS_MUTE_STORAGE_KEY} />
    </div>
  )
}
