import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PLANS, TRIAL_DAYS, type Plan } from '../lib/plans'
import { startCheckout } from '../lib/billing'
import { openExternalUrl } from '../lib/openExternalUrl'
import { tierLabel, tierRank } from '../lib/subscription'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function PricingPage() {
  const { user, isAnonymous, subscriptionTier } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busyTier, setBusyTier] = useState<'basic' | 'pro' | 'premium' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelled = params.get('checkout') === 'cancel'

  async function handleStartTrial(plan: Plan) {
    setError(null)
    if (!user) {
      navigate(`/login?next=/pricing`)
      return
    }
    if (isAnonymous) {
      navigate(`/signup?next=/pricing&reason=upgrade`)
      return
    }
    if (subscriptionTier === plan.id) {
      navigate('/account')
      return
    }
    if (tierRank(subscriptionTier) > tierRank(plan.id)) {
      setError('Use billing portal to change to a lower plan.')
      return
    }

    setBusyTier(plan.id)
    try {
      const { url, upgraded } = await startCheckout(plan.id)
      if (upgraded) {
        navigate('/account?checkout=success')
        return
      }
      await openExternalUrl(url)
    } catch (err) {
      console.error('[pricing] checkout failed', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start checkout. Make sure Stripe is configured on the server.',
      )
    } finally {
      setBusyTier(null)
    }
  }

  return (
    <div className="fade-up mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col space-y-6 overflow-y-auto overscroll-contain pb-10">
      <div className="space-y-1.5">
        <Link to="/" className="im-pill !px-2.5">
          ← Back
        </Link>
        <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-tech-400 uppercase">Pricing</p>
        <h1 className="text-2xl font-semibold tracking-tight text-steel-50 sm:text-3xl">
          Start with {TRIAL_DAYS} days free
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-steel-400">
          Add a card to start your trial — you won&apos;t be charged until day {TRIAL_DAYS + 1}. Basic
          for light use, Pro for unlimited text, Premium when Gus needs to see photos or video.
        </p>
      </div>

      {cancelled && (
        <Card className="border-caution-500/40 p-4 text-sm text-caution-500">
          Checkout canceled — you can start a trial anytime.
        </Card>
      )}
      {subscriptionTier !== 'free' && (
        <Card accent="tech" className="p-4 text-sm text-steel-200">
          You&apos;re on {tierLabel(subscriptionTier)}.{' '}
          <Link to="/account" className="font-medium text-tech-400 hover:underline">
            Manage billing
          </Link>
        </Card>
      )}
      {error && <Card className="border-danger-500/40 p-4 text-sm text-danger-500">{error}</Card>}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = subscriptionTier === plan.id
          const busy = busyTier === plan.id
          const isDowngrade = tierRank(subscriptionTier) > tierRank(plan.id)
          return (
            <Card
              key={plan.id}
              accent={plan.highlighted ? 'yellow' : plan.id === 'premium' ? 'tech' : 'none'}
              className={`flex flex-col p-5 sm:p-6 ${
                plan.highlighted ? 'ring-1 ring-safety-400/35' : plan.id === 'premium' ? 'ring-1 ring-tech-400/25' : ''
              }`}
            >
              <p className="font-mono text-[10px] tracking-[0.16em] text-steel-500 uppercase">{plan.name}</p>
              <p className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight text-steel-50">{plan.priceLabel}</span>
                <span className="text-sm text-steel-500">{plan.priceDetail}</span>
              </p>
              <p className="mt-1 text-xs text-tech-400">{TRIAL_DAYS}-day free trial · card required</p>
              <p className="mt-2 text-sm leading-relaxed text-steel-400">{plan.description}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-steel-200">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span className="mt-0.5 text-tech-400" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.id === 'premium' ? 'secondary' : plan.highlighted ? 'primary' : 'secondary'}
                disabled={Boolean(busyTier) || isCurrent || isDowngrade}
                onClick={() => void handleStartTrial(plan)}
              >
                {isCurrent ? 'Current plan' : isDowngrade ? 'Use billing portal' : busy ? 'Redirecting…' : plan.cta}
              </Button>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs leading-relaxed text-steel-500">
        Cancel before your trial ends to avoid charges. Web billing via Stripe.{' '}
        <Link to="/privacy" className="text-tech-400 hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
