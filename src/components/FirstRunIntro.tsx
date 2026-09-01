import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { GUS_AVATAR_URL } from '../lib/gusAssets'

const STORAGE_KEY = 'ironmedic:seen-intro'

export function FirstRunIntro() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!localStorage.getItem(STORAGE_KEY))
  }, [])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <Card
      accent="yellow"
      className="fade-up mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-4 sm:items-center">
        <img
          src={GUS_AVATAR_URL}
          alt="Gus"
          className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-md"
        />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-steel-50">Say hi to Gus</p>
          <p className="text-sm leading-relaxed text-steel-400">
            Tell him what&apos;s going on and he&apos;ll dig in — real answers, a couple quick
            questions, no forms first.
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" className="shrink-0 self-stretch sm:self-auto" onClick={dismiss}>
        Got it
      </Button>
    </Card>
  )
}
