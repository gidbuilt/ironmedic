import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { streamChat } from '../lib/chat'
import { uploadPhoto, getPhotoPreviewUrl } from '../lib/photos'
import { useAuth } from '../context/AuthContext'
import { getMachine } from '../lib/machines'
import type { Conversation, Diagnosis, DiagnosticStage, DifferentialEntry, Machine } from '../types/database'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { StageStepper } from './StageStepper'
import { MessageBubble } from './MessageBubble'
import { DiagnosisCard } from './DiagnosisCard'
import { DifferentialPanel } from './DifferentialPanel'
import { AvatarPanel } from './avatar/AvatarPanel'
import { sanitizeAssistantDisplay } from '../lib/chatDisplay'
import {
  createGusSpeechStreamer,
  ensureGusUnmuted,
  stopGusSpeech,
  subscribeGusSpeaking,
  unlockGusAudio,
  warmGusSpeak,
} from '../lib/gusVoice'

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  stage: DiagnosticStage | null
  diagnosis?: Diagnosis | null
  verifiedFix?: boolean | null
  photoUrls?: string[]
}

const QUICK_REPLIES = ['Yes', 'No', "I'm not sure", 'It just started', "It's been happening a while"]

export type GusChatPanelProps = {
  machineId: string
  /** Sent once after history loads (dashboard quick-ask / deep link). */
  initialMessage?: string | null
  /** page = full repair route with side Gus; embedded = dock under shop hero */
  variant?: 'page' | 'embedded'
  onBusyChange?: (busy: boolean) => void
  onClose?: () => void
  onInitialMessageConsumed?: () => void
}

export function GusChatPanel({
  machineId,
  initialMessage = null,
  variant = 'page',
  onBusyChange,
  onClose,
  onInitialMessageConsumed,
}: GusChatPanelProps) {
  const { user } = useAuth()
  const [machine, setMachine] = useState<Machine | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [currentStage, setCurrentStage] = useState<DiagnosticStage | null>(null)
  const [differential, setDifferential] = useState<DifferentialEntry[] | null>(null)
  const [input, setInput] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedToast, setCopiedToast] = useState(false)
  const [gusSpeakingAloud, setGusSpeakingAloud] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prefillHandled = useRef(false)

  useEffect(() => subscribeGusSpeaking(setGusSpeakingAloud), [])
  useEffect(() => () => stopGusSpeech(), [])

  useEffect(() => {
    onBusyChange?.(sending || gusSpeakingAloud)
  }, [sending, gusSpeakingAloud, onBusyChange])

  useEffect(() => {
    let cancelled = false
    prefillHandled.current = false
    setLoading(true)
    setError(null)

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
        setError(err instanceof Error ? err.message : 'Failed to load conversation.')
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [machineId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, statusText])

  useEffect(() => {
    if (loading || !initialMessage || prefillHandled.current) return
    prefillHandled.current = true
    onInitialMessageConsumed?.()
    void handleSend(initialMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialMessage])

  const machineLabel = useMemo(() => {
    if (!machine) return ''
    if (!machine.make.trim() || !machine.model.trim()) return machine.name
    const makeModel = `${machine.make} ${machine.model}`
    if (machine.name === makeModel || machine.name === machine.model || machine.name === machine.make) {
      return makeModel
    }
    return `${machine.name} — ${makeModel}`
  }, [machine])

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text && photos.length === 0) return
    if (!user) return

    unlockGusAudio()
    ensureGusUnmuted()
    warmGusSpeak()
    setSending(true)
    setError(null)
    setStatusText(null)
    stopGusSpeech()

    try {
      const photoPaths = await Promise.all(photos.map((file) => uploadPhoto(user.id, machineId, file)))
      const localPhotoUrls = photos.map((f) => URL.createObjectURL(f))

      const userMsg: LocalMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text || "Here's a photo.",
        stage: null,
        photoUrls: localPhotoUrls,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setPhotos([])

      const assistantId = `local-assistant-${Date.now()}`
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', stage: null }])

      let spokenText = ''
      const speech = createGusSpeechStreamer()
      speech.start()

      await streamChat({
        machineId,
        message: text,
        photoPaths,
        onEvent: (event) => {
          if (event.type === 'text') {
            spokenText += event.text
            const display = sanitizeAssistantDisplay(spokenText)
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: display } : m)),
            )
            speech.feed(spokenText)
          } else if (event.type === 'status') {
            setStatusText(
              event.status === 'searching_web'
                ? 'Gus is checking what other operators have reported for this model…'
                : null,
            )
          } else if (event.type === 'done') {
            setStatusText(null)
            setCurrentStage(event.stage)
            if (event.differential && event.differential.length > 0) {
              setDifferential(event.differential)
            }
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, stage: event.stage, diagnosis: event.diagnosis } : m)),
            )
            if (event.machine) setMachine(event.machine)
            if (spokenText) {
              const display = sanitizeAssistantDisplay(spokenText)
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: display } : m)),
              )
              speech.finish(display)
            } else if (event.diagnosis) {
              speech.finish(
                `${event.diagnosis.summary}. ${event.diagnosis.ranked_causes?.[0]?.cause ?? ''}`,
              )
            }
          } else if (event.type === 'error') {
            setError(event.message)
          }
        },
      })
    } catch (err) {
      const e = err as Error & { status?: number }
      if (e.status === 402) {
        setError("You've used all your free diagnoses. Upgrade to keep working with Gus.")
      } else {
        setError(e.message || 'Something went wrong talking to Gus.')
      }
    } finally {
      setSending(false)
      setStatusText(null)
    }
  }

  const gusSpeaking = sending || gusSpeakingAloud
  const embedded = variant === 'embedded'

  if (loading) {
    return (
      <p className={`text-steel-400 ${embedded ? 'px-4 py-3 text-sm' : ''}`}>
        Loading conversation&hellip;
      </p>
    )
  }

  const messageList = (
    <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      {differential && differential.length > 0 && (
        <DifferentialPanel
          key={`${differential[0]?.cause ?? ''}-${differential[0]?.confidence ?? ''}-${differential.length}`}
          entries={differential}
        />
      )}

      {messages.length === 0 && (
        <Card accent="tech" className="p-4 text-sm text-steel-300">
          Tell Gus what&apos;s going on — he&apos;ll dig in right away.
        </Card>
      )}
      {messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-2">
          <MessageBubble role={m.role} streaming={sending && m.content === '' && m.role === 'assistant'}>
            {m.photoUrls && m.photoUrls.length > 0 && (
              <div className="mb-2 flex gap-2">
                {m.photoUrls.map((url, i) => (
                  <img key={i} src={url} alt="Attached" className="h-24 w-24 rounded-2xl object-cover" />
                ))}
              </div>
            )}
            {m.content}
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
      ))}
      {statusText && <p className="text-sm italic text-steel-400">{statusText}</p>}
      {error && <Card className="border-danger-500/40 p-3 text-sm text-danger-500">{error}</Card>}
    </div>
  )

  const composer = (
    <div className="shrink-0 border-t border-steel-800 bg-steel-950 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mb-2 flex flex-wrap gap-2">
        {QUICK_REPLIES.map((qr) => (
          <button
            key={qr}
            type="button"
            disabled={sending}
            onClick={() => void handleSend(qr)}
            className="rounded-xl border border-steel-600 bg-steel-800 px-3 py-1.5 text-sm text-steel-200 transition-colors hover:border-tech-400/60 disabled:opacity-40"
          >
            {qr}
          </button>
        ))}
      </div>

      {photos.length > 0 && (
        <div className="mb-2 flex gap-2">
          {photos.map((f, i) => (
            <div key={i} className="relative">
              <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-steel-950 text-xs text-steel-300"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSend()
        }}
        className="flex items-end gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 px-3"
          onClick={() => fileInputRef.current?.click()}
          title="Attach a photo"
        >
          📷
        </Button>
        <Button type="button" variant="ghost" className="min-h-12 px-3" disabled title="Voice input coming soon">
          🎙️
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
          placeholder="Tell Gus what's going on…"
          rows={1}
          className="min-h-12 flex-1 resize-none rounded-xl border border-steel-600 bg-steel-800 px-4 py-3 text-base
            text-steel-50 placeholder:text-steel-400 outline-none focus:border-tech-400"
        />
        <Button type="submit" disabled={sending || (!input.trim() && photos.length === 0)} className="min-h-12">
          {sending ? '…' : 'Send'}
        </Button>
      </form>
    </div>
  )

  if (embedded) {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-steel-950/95 backdrop-blur-md">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-steel-800 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-steel-100">{machineLabel || 'Gus'}</p>
            {currentStage && (
              <div className="mt-1">
                <StageStepper activeStage={currentStage} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={`/machines/${machineId}/log`}
              className="text-xs text-steel-400 hover:text-steel-200"
            >
              Log
            </Link>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xs text-steel-400 hover:bg-steel-800 hover:text-steel-100"
              >
                Minimize
              </button>
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 sm:px-4">{messageList}</div>
        <div className="px-3 sm:px-4">{composer}</div>
        {copiedToast && (
          <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-tech-400/40 bg-steel-800 px-4 py-2 text-sm text-steel-100 shadow-lg">
            Report copied to clipboard
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-w-5xl flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <Link to={`/machines/${machineId}`} className="truncate text-sm text-steel-400 hover:text-steel-200">
          &larr; {machineLabel}
        </Link>
        <Link to={`/machines/${machineId}/log`} className="shrink-0 text-sm text-steel-400 hover:text-steel-200">
          Service Log
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
        <div className="mx-auto w-full max-w-[11rem] shrink-0 sm:mx-0 sm:w-44 md:w-52">
          <AvatarPanel speaking={gusSpeaking} size="side" />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {currentStage && (
            <div className="mb-2 shrink-0">
              <StageStepper activeStage={currentStage} />
            </div>
          )}
          {messageList}
        </div>
      </div>

      {composer}

      {copiedToast && (
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-tech-400/40 bg-steel-800 px-4 py-2 text-sm text-steel-100 shadow-lg">
          Report copied to clipboard
        </div>
      )}
    </div>
  )
}
