import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { deleteManual, listManuals, uploadManual } from '../lib/manuals'
import type { Manual } from '../types/database'
import { Card } from './ui/Card'
import { Button } from './ui/Button'

const STATUS_LABEL: Record<Manual['extraction_status'], string> = {
  pending: 'Processing…',
  ok: 'Ready — Gus can reference this',
  empty_scanned_pdf: "Scanned image PDF — couldn't extract text",
  error: 'Failed to process',
}

export function ManualsSection({ machineId }: { machineId: string }) {
  const { user } = useAuth()
  const [manuals, setManuals] = useState<Manual[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listManuals(machineId).then(setManuals).catch((err) => setError(err.message))
  }, [machineId])

  async function handleUpload(file: File) {
    if (!user) return
    setUploading(true)
    setError(null)
    try {
      const manual = await uploadManual(user.id, machineId, file)
      setManuals((prev) => [manual, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-steel-500 uppercase">
            Reference material
          </p>
          <p className="mt-1 font-semibold text-steel-50">Manual</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-400">
            Upload the owner&apos;s manual for this exact machine — Gus treats it as the most
            authoritative source.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
            e.target.value = ''
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 self-stretch sm:self-auto"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : '+ Upload PDF'}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      {manuals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-steel-700/80 bg-steel-950/40 px-4 py-6 text-center">
          <p className="text-sm text-steel-400">No manual uploaded yet</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {manuals.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-steel-700/70 bg-steel-950/40 px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-steel-100">{m.filename}</p>
                <p
                  className={`mt-0.5 text-xs ${m.extraction_status === 'ok' ? 'text-safe-500' : 'text-steel-400'}`}
                >
                  {STATUS_LABEL[m.extraction_status]}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-danger-500 hover:bg-danger-500/10"
                onClick={async () => {
                  await deleteManual(m)
                  setManuals((prev) => prev.filter((x) => x.id !== m.id))
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {manuals.some((m) => m.extraction_status === 'empty_scanned_pdf') && (
        <p className="mt-3 text-xs leading-relaxed text-steel-500">
          This looks like a scanned-image PDF rather than real text, so Gus can&apos;t read it yet. A
          text-based PDF from the manufacturer&apos;s site usually works better than a photocopy scan.
        </p>
      )}
    </Card>
  )
}
