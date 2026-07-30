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
    <Card accent="yellow" className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <img src={GUS_AVATAR_URL} alt="Gus" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
        <div>
          <p className="font-semibold text-steel-50">Say hi to Gus</p>
          <p className="mt-1 text-sm text-steel-400">
            Tell him what's going on and he'll dig in right away — real answers, a couple quick questions, no
            forms to fill out first.
          </p>
        </div>
      </div>
      <Button variant="secondary" className="min-h-10 shrink-0 px-4 py-2 text-sm" onClick={dismiss}>
        Got it
      </Button>
    </Card>
  )
}
