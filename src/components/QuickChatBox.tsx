import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { createMachine } from '../lib/machines'
import { Button } from './ui/Button'

/** Sentinel nickname for machines created from the dashboard quick-chat box,
 * before Gus has extracted real make/model from the conversation. The
 * gus-chat Edge Function checks for this exact value to know it's safe to
 * overwrite the name once it identifies the equipment. */
export const QUICK_CHAT_PLACEHOLDER_NAME = 'New machine'

type QuickChatBoxProps = {
  /** When set, stay on the dashboard and open an embedded chat dock. */
  onSessionStart?: (machineId: string, message: string) => void
}

/**
 * Home composer. Creates a placeholder machine and opens the conversation
 * via `onSessionStart`.
 */
export function QuickChatBox({ onSessionStart }: QuickChatBoxProps) {
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = question.trim()
    if (!text || !user || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const machine = await createMachine(user.id, {
        name: QUICK_CHAT_PLACEHOLDER_NAME,
        make: '',
        model: '',
        serial_number: null,
        hours: null,
      })
      setQuestion('')
      onSessionStart?.(machine.id, text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <div className="shrink-0">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-steel-700/80 bg-steel-900/70 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-md"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Gus what’s going on…"
            rows={2}
            className="im-field min-h-[3.25rem] max-h-36 flex-1 border-transparent bg-transparent px-3 py-2.5 shadow-none focus:border-transparent focus:shadow-none"
          />
          <Button
            type="submit"
            disabled={submitting || !question.trim()}
            className="mb-0.5 mr-0.5 shrink-0"
            size="md"
          >
            {submitting ? '…' : 'Ask Gus'}
          </Button>
        </div>
      </form>
      {error && <p className="mt-2.5 text-sm text-danger-500">{error}</p>}
    </div>
  )
}
