import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TRIAL_DAYS } from '../lib/plans'
import { isNativeIos } from '../lib/platform'
import { Button } from './ui/Button'

type TrialPromptProps = {
  className?: string
  compact?: boolean
}

/** Shown when chat requires an active subscription or trial. */
export function TrialPrompt({ className = '', compact = false }: TrialPromptProps) {
  const { isAnonymous } = useAuth()
  const iosBilling = isNativeIos()

  return (
    <div
      className={`rounded-3xl border border-steel-700/80 bg-steel-900/70 text-center shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-md ${
        compact ? 'p-4' : 'p-5'
      } ${className}`}
    >
      <p className={`font-medium text-steel-100 ${compact ? 'text-sm' : 'text-[15px]'}`}>
        Start your {TRIAL_DAYS}-day free trial
      </p>
      <p className={`mt-1.5 leading-relaxed text-steel-400 ${compact ? 'text-xs' : 'text-sm'}`}>
        {isAnonymous
          ? iosBilling
            ? 'Create an account, then subscribe with your Apple ID to try Gus on real shop problems.'
            : 'Create an account, add a card, and try Gus on real shop problems.'
          : iosBilling
            ? 'Subscribe with your Apple ID to unlock Gus — cancel anytime before your trial ends.'
            : 'Add a card to unlock Gus — cancel anytime before your trial ends.'}
      </p>
      <Link to={isAnonymous ? '/signup?next=/pricing' : '/pricing'} className="mt-4 inline-block">
        <Button size={compact ? 'sm' : 'md'}>{isAnonymous ? 'Create account' : 'Start free trial'}</Button>
      </Link>
    </div>
  )
}
