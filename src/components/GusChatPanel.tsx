import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { streamChat } from '../lib/chat'
import { uploadPhoto, getPhotoPreviewUrl } from '../lib/photos'
import { canAttachPhotos } from '../lib/subscription'
import { useAuth } from '../context/AuthContext'
import { getMachine } from '../lib/machines'
import { isTransientNetworkError } from '../lib/networkError'
import type { Conversation, Diagnosis, DiagnosticStage, DifferentialEntry, Machine } from '../types/database'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { StageStepper } from './StageStepper'
import { MessageBubble } from './MessageBubble'
import { DiagnosisCard } from './DiagnosisCard'
import { DifferentialPanel } from './DifferentialPanel'
import { sanitizeAssistantDisplay } from '../lib/chatDisplay'
import { GUS_SHOP_CHAT_BG_URL } from '../lib/gusAssets'
import { QUICK_CHAT_PLACEHOLDER_NAME } from '../lib/quickChat'
import { TrialPrompt } from './TrialPrompt'

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  stage: DiagnosticStage | null
  diagnosis?: Diagnosis | null
  verifiedFix?: boolean | null
  photoUrls?: string[]
}

const NEAR_BOTTOM_PX = 96

export type GusChatPanelProps = {
  machineId: string
  /** Sent once after history loads (dashboard quick-ask / deep link). */
  initialMessage?: string | null
  /** page = full repair route; embedded = home session panel */
  variant?: 'page' | 'embedded'
  onClose?: () => void
  /** Start fresh on the home composer (leave this conversation). */
  onNewChat?: () => void
  onInitialMessageConsumed?: () => void
}

export function GusChatPanel({
  machineId,
  initialMessage = null,
  variant = 'page',
  onClose,
  onNewChat,
  onInitialMessageConsumed,
}: GusChatPanelProps) {
  const { user, recoverSession, isSubscribed, subscriptionTier } = useAuth()
  const photosAllowed = canAttachPhotos(subscriptionTier)
  const [machine, setMachine] = useState<Machine | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [currentStage, setCurrentStage] = useState<DiagnosticStage | null>(null)
  const [differential, setDifferential] = useState<DifferentialEntry[] | null>(null)
  const [input, setInput] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedToast, setCopiedToast] = useState(false)
  const [photoUpgradePrompt, setPhotoUpgradePrompt] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinToBottomRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prefillHandled = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastSendRef = useRef<{ text: string; photoPaths: string[]; localPhotoUrls: string[] } | null>(null)
  /** Sync guard — state alone can allow a double-tap before re-render. */
  const sendingRef = useRef(false)
  /** True if the user left the app while a Gus request was in flight. */
  const leftAppDuringSendRef = useRef(false)
  /** Forces the shop photo to remount/decode when reopening a chat (iOS WKWebView). */
  const [bgNonce, setBgNonce] = useState(() => Date.now())

  useEffect(() => {
    setBgNonce(Date.now())
  }, [machineId])

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f))
    setPhotoPreviewUrls(urls)
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [photos])

  useEffect(() => {
    let cancelled = false
    prefillHandled.current = false
    setLoading(true)
    setError(null)
    setErrorCode(null)
    setRetryable(false)

    async function load() {
      const [machineData, { data: convRows }, { data: diagRows }] = await Promise.all([
        getMachine(machineId),
        supabase.from('conversations').select('*').eq('machine_id', machineId).order('created_at', { ascending: true }),
        supabase.from('diagnoses').select('*').eq('machine_id', machineId).order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      setMachine(machineData)

      const diagByConversation = new Map<string, Diagnosis>()
      for (const d of (diagRows ?? []) as Diagnosis[]) {
        if (d.conversation_id) diagByConversation.set(d.conversation_id, d)
      }

      const loaded: LocalMessage[] = []
      for (const row of (convRows ?? []) as Conversation[]) {
        if (row.role === 'system') continue
        const photoUrls =
          row.role === 'user' && Array.isArray(row.photo_paths) && row.photo_paths.length
            ? await Promise.all(row.photo_paths.map((p: string) => getPhotoPreviewUrl(p)))
            : []
        loaded.push({
          id: row.id,
          role: row.role,
          content: row.role === 'assistant' ? sanitizeAssistantDisplay(row.content) : row.content,
          stage: row.stage,
          diagnosis: diagByConversation.get(row.id) ?? null,
          photoUrls: photoUrls.filter(Boolean) as string[],
        })
      }
      setMessages(loaded)
      const lastStage = [...loaded].reverse().find((m) => m.stage)?.stage ?? null
      setCurrentStage(lastStage)
      const lastDifferential = [...((convRows ?? []) as Conversation[])].reverse().find((r) => r.differential?.length)
        ?.differential
      setDifferential(lastDifferential ?? null)
      setLoading(false)
    }

    load().catch((err) => {
      if (!cancelled) {
        if (isTransientNetworkError(err)) {
          setError('Couldn’t reach Gus. Check your connection and try again.')
          setRetryable(true)
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load conversation.')
          setRetryable(false)
        }
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [machineId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !pinToBottomRef.current) return
    el.scrollTop = el.scrollHeight
  }, [messages, statusText])

  useEffect(() => {
    if (loading || !initialMessage || prefillHandled.current) return
    prefillHandled.current = true
    onInitialMessageConsumed?.()
    void handleSend(initialMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialMessage])

  useEffect(() => {
    // Keep Gus streaming while the user checks mail / locks the phone.
    // Do not abort — iOS may still suspend the socket after ~30s; we recover softly.
    const onBackground = () => {
      if (abortRef.current) leftAppDuringSendRef.current = true
    }
    const onForeground = () => {
      void recoverSession()
    }

    if (Capacitor.isNativePlatform()) {
      let handle: { remove: () => Promise<void> } | undefined
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) onForeground()
        else onBackground()
      }).then((h) => {
        handle = h
      })
      return () => {
        void handle?.remove()
      }
    }

    const onVis = () => {
      if (document.visibilityState === 'hidden') onBackground()
      else onForeground()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [recoverSession])

  const machineLabel = useMemo(() => {
    if (!machine) return ''
    // Placeholder / unnamed quick-chat sessions — don't show "New machine" in chrome.
    if (
      machine.name === QUICK_CHAT_PLACEHOLDER_NAME ||
      (!machine.make.trim() && !machine.model.trim())
    ) {
      return ''
    }
    const makeModel = `${machine.make} ${machine.model}`.trim()
    if (!makeModel) return machine.name
    if (machine.name === makeModel || machine.name === machine.model || machine.name === machine.make) {
      return makeModel
    }
    return `${machine.name} — ${makeModel}`
  }, [machine])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    pinToBottomRef.current = distance <= NEAR_BOTTOM_PX
  }, [])

  async function runStream(params: {
    messageText: string
    photoPaths: string[]
    localPhotoUrls: string[]
    skipUserBubble?: boolean
  }) {
    const { messageText, photoPaths, localPhotoUrls, skipUserBubble } = params
    lastSendRef.current = { text: messageText, photoPaths, localPhotoUrls }

    pinToBottomRef.current = true
    sendingRef.current = true
    setSending(true)
    setError(null)
    setErrorCode(null)
    setRetryable(false)
    leftAppDuringSendRef.current = false

    if (!skipUserBubble) {
      const userMsg: LocalMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: messageText,
        stage: null,
        photoUrls: localPhotoUrls,
      }
      setMessages((prev) => [...prev, userMsg])
    }

    const streamAssistantId = `local-assistant-${Date.now()}`
    setMessages((prev) => {
      const cleaned = prev.filter(
        (m) => !(m.role === 'assistant' && m.id.startsWith('local-assistant-') && !m.content.trim()),
      )
      return [...cleaned, { id: streamAssistantId, role: 'assistant', content: '', stage: null }]
    })

    const controller = new AbortController()
    abortRef.current = controller
    let replyText = ''

    try {
      await streamChat({
        machineId,
        message: messageText,
        photoPaths,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'text') {
            replyText += event.text
            const display = sanitizeAssistantDisplay(replyText)
            setMessages((prev) =>
              prev.map((m) => (m.id === streamAssistantId ? { ...m, content: display } : m)),
            )
          } else if (event.type === 'status') {
            setStatusText(
              event.status === 'searching_web'
                ? 'Running live web & forum intelligence for this make & model…'
                : null,
            )
          } else if (event.type === 'done') {
            setStatusText(null)
            setCurrentStage(event.stage)
            if (event.differential && event.differential.length > 0 && !event.diagnosis) {
              setDifferential(event.differential)
            }
            if (event.diagnosis) {
              setDifferential(null)
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamAssistantId ? { ...m, stage: event.stage, diagnosis: event.diagnosis } : m,
              ),
            )
            if (event.machine) setMachine(event.machine)
            if (replyText) {
              const display = sanitizeAssistantDisplay(replyText)
              setMessages((prev) =>
                prev.map((m) => (m.id === streamAssistantId ? { ...m, content: display } : m)),
              )
            }
          } else if (event.type === 'error') {
            setError(event.message)
            setRetryable(true)
          }
        },
      })
    } catch (err) {
      const e = err as Error & { status?: number; code?: string }
      if (e.status === 402) {
        setErrorCode(e.code ?? null)
        if (e.code === 'premium_required') {
          setError(
            e.message ||
              'Photo analysis requires Premium. Upgrade to attach images in chat.',
          )
        } else if (e.code === 'monthly_limit_reached') {
          setError(
            e.message ||
              "You've hit your Basic plan's monthly diagnostic limit. Upgrade to Pro for unlimited text.",
          )
        } else if (e.code === 'subscription_required') {
          setError(
            e.message ||
              'Start your 7-day free trial to use Gus — card required, cancel anytime before it ends.',
          )
        } else {
          setError(e.message || 'A subscription is required to continue.')
        }
        setRetryable(false)
      } else if (isTransientNetworkError(err)) {
        // Keep any partial reply. Soft copy if they left the app mid-stream.
        setStatusText(null)
        if (!replyText.trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== streamAssistantId))
        }
        if (leftAppDuringSendRef.current) {
          setRetryable(true)
          setError(
            replyText.trim()
              ? 'Gus may have more to say — tap Retry if the reply looks cut off.'
              : 'Gus got interrupted while you were away. Tap Retry to continue.',
          )
        } else {
          setRetryable(true)
          setError('Connection dropped. Tap Retry to continue.')
        }
      } else {
        setError(e.message || 'Something went wrong talking to Gus.')
        setRetryable(true)
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      sendingRef.current = false
      setSending(false)
      setStatusText(null)
      leftAppDuringSendRef.current = false
    }
  }

  async function handleSend(overrideText?: string) {
    if (sendingRef.current) return
    const text = (overrideText ?? input).trim()
    const attached = [...photos]
    if (!text && attached.length === 0) return
    if (!user) {
      setError('Not signed in — reload the page to start a guest session.')
      setRetryable(false)
      return
    }
    if (attached.length > 0 && !canAttachPhotos(subscriptionTier)) {
      setErrorCode('premium_required')
      setError('Photo attachments require Premium. Upgrade to send images to Gus.')
      setRetryable(false)
      return
    }

    // Lock the composer immediately — photo upload can take several seconds
    // before runStream starts, and people will tap Send again without feedback.
    sendingRef.current = true
    setSending(true)
    setError(null)
    setErrorCode(null)
    setRetryable(false)
    const uploadLabel =
      attached.length > 1 ? `Uploading ${attached.length} photos…` : 'Uploading photo…'
    setStatusText(attached.length > 0 ? uploadLabel : 'Sending…')

    try {
      await recoverSession()
      const photoPaths =
        attached.length > 0
          ? await Promise.all(attached.map((file) => uploadPhoto(user.id, machineId, file)))
          : []
      const localPhotoUrls = attached.map((f) => URL.createObjectURL(f))
      const messageText = text || "Here's a photo."
      setInput('')
      setPhotos([])
      setStatusText(null)
      await runStream({ messageText, photoPaths, localPhotoUrls })
    } catch (err) {
      if (isTransientNetworkError(err)) {
        setError('Paused — connection dropped. Tap Retry to continue.')
        setRetryable(true)
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong talking to Gus.')
        setRetryable(true)
      }
      sendingRef.current = false
      setSending(false)
      setStatusText(null)
    }
  }

  async function handleRetry() {
    const last = lastSendRef.current
    setError(null)
    setErrorCode(null)
    setRetryable(false)
    await recoverSession()
    if (last) {
      await runStream({
        messageText: last.text,
        photoPaths: last.photoPaths,
        localPhotoUrls: last.localPhotoUrls,
        skipUserBubble: true,
      })
      return
    }
    window.location.reload()
  }

  const embedded = variant === 'embedded'

  if (loading) {
    return (
      <div className={`space-y-3 ${embedded ? 'px-4 py-4' : 'p-4'}`}>
        <div className="im-skeleton h-16 w-[70%] rounded-2xl" />
        <div className="im-skeleton ml-auto h-12 w-[55%] rounded-2xl" />
        <div className="im-skeleton h-20 w-[75%] rounded-2xl" />
        <p className="pt-2 text-sm text-steel-500">Loading conversation…</p>
      </div>
    )
  }

  const messageList = (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2"
    >
      {differential && differential.length > 0 && !messages.some((m) => m.diagnosis) && (
        <DifferentialPanel
          key={`${differential[0]?.cause ?? ''}-${differential[0]?.confidence ?? ''}-${differential.length}`}
          entries={differential}
        />
      )}

      {messages.length === 0 && (
        <div className="mx-auto max-w-sm rounded-2xl border border-tech-400/25 bg-steel-950/70 px-4 py-5 text-center backdrop-blur-md">
          <p className="text-sm font-medium text-steel-100">Gus is ready</p>
          <p className="mt-1.5 text-sm leading-relaxed text-steel-400">
            Tell him what&apos;s going on — he&apos;ll dig in right away.
          </p>
        </div>
      )}
      {(() => {
        const lastAssistantIdx = (() => {
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === 'assistant') return i
          }
          return -1
        })()
        return messages.map((m, idx) => {
        const isLatestAssistant = m.role === 'assistant' && idx === lastAssistantIdx
        return (
        <div key={m.id} className="flex flex-col gap-2">
          <MessageBubble
            role={m.role}
            content={m.role === 'assistant' ? m.content : undefined}
            streaming={sending && m.role === 'assistant' && idx === messages.length - 1}
            onSelectCheck={
              isLatestAssistant && !sending
                ? (item) => {
                    void handleSend(item)
                  }
                : undefined
            }
            differential={isLatestAssistant && !m.diagnosis ? differential : undefined}
            diagnosisReportMode={m.role === 'assistant' && Boolean(m.diagnosis)}
          >
            {m.role === 'user' ? (
              <>
                {m.photoUrls && m.photoUrls.length > 0 && (
                  <div className="mb-2 flex gap-2">
                    {m.photoUrls.map((url, i) => (
                      <img key={i} src={url} alt="Attached" className="h-24 w-24 rounded-2xl object-cover" />
                    ))}
                  </div>
                )}
                {m.content}
              </>
            ) : (
              m.photoUrls &&
              m.photoUrls.length > 0 && (
                <div className="mb-2 flex gap-2">
                  {m.photoUrls.map((url, i) => (
                    <img key={i} src={url} alt="Attached" className="h-24 w-24 rounded-2xl object-cover" />
                  ))}
                </div>
              )
            )}
          </MessageBubble>
          {m.diagnosis && (
            <DiagnosisCard
              diagnosis={m.diagnosis}
              machineLabel={machineLabel}
              onCopied={() => {
                setCopiedToast(true)
                setTimeout(() => setCopiedToast(false), 2000)
              }}
            />
          )}
        </div>
        )
      })
      })()}
      {statusText && (
        <p className="flex items-center gap-2 text-sm text-tech-300/90">
          <span className="relative flex h-1.5 w-1.5">
            <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-tech-400" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tech-400" />
          </span>
          {statusText}
        </p>
      )}
      {error && (
        <Card
          className={`p-4 text-sm ${
            retryable ? 'border-caution-500/35 text-caution-500' : 'border-danger-500/40 text-danger-500'
          }`}
        >
          <p className="leading-relaxed">{error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {retryable && (
              <Button type="button" size="sm" onClick={() => void handleRetry()} disabled={sending}>
                Retry
              </Button>
            )}
            {(errorCode === 'subscription_required' ||
              error.toLowerCase().includes('free trial')) && (
              <Link
                to="/pricing"
                className="inline-flex items-center text-sm font-medium text-safety-400 hover:underline"
              >
                Start free trial →
              </Link>
            )}
            {(errorCode === 'monthly_limit_reached' ||
              error.toLowerCase().includes('monthly')) && (
              <Link
                to="/pricing"
                className="inline-flex items-center text-sm font-medium text-tech-400 hover:underline"
              >
                Upgrade to Pro →
              </Link>
            )}
            {(errorCode === 'premium_required' ||
              error.toLowerCase().includes('premium')) && (
              <Link
                to="/pricing"
                className="inline-flex items-center text-sm font-medium text-tech-400 hover:underline"
              >
                Upgrade to Premium →
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  )

  const composer = (
    <div className="im-composer-dock shrink-0 border-t border-steel-800/60 bg-gradient-to-t from-steel-950 via-steel-950/95 to-steel-950/80 pt-2">
      {!isSubscribed ? (
        <div className="px-3 pb-2 sm:px-4">
          <TrialPrompt compact />
        </div>
      ) : (
        <>
      {photoUpgradePrompt && !photosAllowed && (
        <div className="mb-2.5 flex items-start gap-2 rounded-2xl border border-steel-700/80 bg-steel-900/90 px-3.5 py-3 text-sm text-steel-300">
          <p className="min-w-0 flex-1 leading-relaxed">
            Photo analysis is a{' '}
            <span className="font-medium text-steel-100">Premium</span> feature. Upgrade to send
            photos to Gus.
          </p>
          <Link
            to="/pricing"
            className="shrink-0 font-medium text-tech-400 hover:underline"
            onClick={() => setPhotoUpgradePrompt(false)}
          >
            Upgrade
          </Link>
          <button
            type="button"
            onClick={() => setPhotoUpgradePrompt(false)}
            className="shrink-0 text-steel-500 hover:text-steel-300"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {photos.length > 0 && (
        <div className="mb-2.5 flex gap-2 px-3 sm:px-4">
          {photos.map((f, i) => (
            <div key={`${f.name}-${f.size}-${f.lastModified}`} className="relative shrink-0">
              <img
                src={photoPreviewUrls[i] ?? ''}
                alt=""
                className="h-16 w-16 rounded-2xl object-cover"
              />
              {sending ? (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-steel-950/65"
                  aria-hidden
                >
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-tech-400/30 border-t-tech-400" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-steel-600 bg-steel-950 text-xs text-steel-300"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {sending && statusText && (
        <p className="mb-2 flex items-center gap-2 px-3 text-sm text-tech-300/90 sm:px-4" aria-live="polite">
          <span className="relative flex h-1.5 w-1.5">
            <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-tech-400" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tech-400" />
          </span>
          {statusText}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSend()
        }}
        className={`mx-3 mb-2 rounded-3xl border bg-steel-900/85 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md sm:mx-4 ${
          sending ? 'border-tech-400/45' : 'border-steel-700/70'
        }`}
      >
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) setPhotos((prev) => [...prev, ...files])
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={sending}
            onClick={() => {
              if (!photosAllowed) {
                setPhotoUpgradePrompt(true)
                return
              }
              setPhotoUpgradePrompt(false)
              fileInputRef.current?.click()
            }}
            title={photosAllowed ? 'Attach a photo' : 'Premium required for photos'}
            aria-label={photosAllowed ? 'Attach a photo' : 'Premium required for photos'}
            className={`!rounded-2xl ${
              photosAllowed
                ? 'text-steel-300 hover:text-steel-50'
                : 'cursor-pointer text-steel-600 opacity-40 hover:opacity-55'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M9.15 3.75c-.4 0-.78.19-1.02.51L7.1 5.6c-.24.32-.62.51-1.02.51H6A3 3 0 0 0 3 9.1v8.4a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9.1a3 3 0 0 0-3-3h-.08c-.4 0-.78-.19-1.02-.51l-1.03-1.34a1.28 1.28 0 0 0-1.02-.5H9.15Zm2.85 6.35a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm-1.9 3.4a1.9 1.9 0 1 1 3.8 0 1.9 1.9 0 0 1-3.8 0Z"
              />
            </svg>
          </Button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={photos.length > 0 ? 'Add a caption (optional)…' : "Tell Gus what's going on…"}
            rows={1}
            disabled={sending}
            className="im-field min-h-11 max-h-28 flex-1 border-transparent bg-transparent px-2 py-2.5 shadow-none focus:border-transparent focus:shadow-none disabled:opacity-70"
          />
          <Button
            type="submit"
            disabled={sending || (!input.trim() && photos.length === 0)}
            size="sm"
            className="mb-0.5 mr-0.5 shrink-0 min-w-[4.5rem]"
          >
            {sending
              ? photos.length > 0 || statusText?.startsWith('Uploading')
                ? 'Uploading…'
                : 'Sending…'
              : 'Send'}
          </Button>
        </div>
      </form>
        </>
      )}
    </div>
  )

  const chatShell = (opts: { embedded: boolean }) => (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Explicit <img> (not CSS background) so iOS re-decodes when remounting old chats. */}
      <img
        key={bgNonce}
        src={`${GUS_SHOP_CHAT_BG_URL}&t=${bgNonce}`}
        alt=""
        decoding="async"
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        style={{ transform: 'translateZ(0)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-steel-950/50 via-steel-950/30 to-steel-950/70"
        aria-hidden
      />

      <div
        className={`relative z-[1] flex shrink-0 items-center justify-between gap-2 border-b border-steel-800/50 bg-steel-950/75 px-3 py-2.5 backdrop-blur-md sm:px-4 ${
          opts.embedded ? '' : 'rounded-t-xl'
        }`}
      >
        {opts.embedded ? (
          <>
            <div className="min-w-0 flex-1">
              {machineLabel ? (
                <p className="truncate text-sm font-semibold text-steel-50">{machineLabel}</p>
              ) : (
                <p className="truncate text-sm font-medium text-steel-400">New session</p>
              )}
              {currentStage && (
                <div className="mt-1.5">
                  <StageStepper activeStage={currentStage} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link to={`/machines/${machineId}/log`} className="im-pill !py-1">
                Log
              </Link>
              {onClose && (
                <button type="button" onClick={onClose} className="im-pill !py-1">
                  Minimize
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">{currentStage ? <StageStepper activeStage={currentStage} /> : null}</div>
            <div className="flex shrink-0 items-center gap-2">
              {onNewChat && (
                <button
                  type="button"
                  onClick={onNewChat}
                  className="inline-flex items-center rounded-full border border-safety-400/45 bg-safety-400/15 px-3 py-1 text-xs font-semibold text-safety-400"
                >
                  New chat
                </button>
              )}
              <Link to={`/machines/${machineId}/log`} className="im-pill">
                Service Log
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col px-3 pt-2 sm:px-4">{messageList}</div>
      <div className="relative z-[1] shrink-0 px-3 pb-0 sm:px-4">{composer}</div>

      {copiedToast && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-tech-400/40 bg-steel-900/95 px-4 py-2.5 text-sm text-steel-100 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          Report copied to clipboard
        </div>
      )}
    </div>
  )

  if (embedded) {
    return chatShell({ embedded: true })
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col">{chatShell({ embedded: false })}</div>
  )
}
