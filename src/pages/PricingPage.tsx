import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PLANS } from '../lib/plans'
import { startProCheckout } from '../lib/billing'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function PricingPage() {
  const { user, isAnonymous, isSubscribed } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelled = params.get('checkout') === 'cancel'

  async function handlePro() {
    setError(null)
    if (!user) {
      navigate('/login?next=/pricing')
      return
    }
    if (isAnonymous) {
      navigate('/signup?next=/pricing&reason=upgrade')
      return
    }
    if (isSubscribed) {
      navigate('/account')
      return
    }
    setBusy(true)
    try {
      const url = await startProCheckout()
      window.location.assign(url)
    } catch (err) {
      console.error('[pricing] checkout failed', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start checkout. Make sure Stripe is configured on the server.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fade-up mx-auto max-w-3xl space-y-6 pb-10">
      <div className="space-y-1.5">
        <Link to="/" className="im-pill !px-2.5">
          ← Back
        </Link>
        <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-tech-400 uppercase">Pricing</p>
        <h1 className="text-2xl font-semibold tracking-tight text-steel-50 sm:text-3xl">
          Pick a plan that fits the shop
        </h1>
        <p className="max-w-lg text-[15px] leading-relaxed text-steel-400">
          Start free. Upgrade when Gus is earning his keep on real machines.
        </p>
      </div>

      {cancelled && (
        <Card className="border-caution-500/40 p-4 text-sm text-caution-500">
          Checkout canceled — you can upgrade anytime.
        </Card>
      )}
      {isSubscribed && (
        <Card accent="tech" className="p-4 text-sm text-steel-200">
          You&apos;re on Pro.{' '}
          <Link to="/account" className="font-medium text-tech-400 hover:underline">
            Manage billing
          </Link>
        </Card>
      )}
      {error && <Card className="border-danger-500/40 p-4 text-sm text-danger-500">{error}</Card>}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            accent={plan.highlighted ? 'yellow' : 'none'}
            className={`flex flex-col p-5 sm:p-6 ${plan.highlighted ? 'ring-1 ring-safety-400/35' : ''}`}
          >
            <p className="font-mono text-[10px] tracking-[0.16em] text-steel-500 uppercase">{plan.name}</p>
            <p className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-steel-50">{plan.priceLabel}</span>
              <span className="text-sm text-steel-500">{plan.priceDetail}</span>
            </p>
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
            {plan.id === 'free' ? (
              <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate('/')}>
                {plan.cta}
              </Button>
            ) : (
              <Button className="mt-6 w-full" disabled={busy || isSubscribed} onClick={() => void handlePro()}>
                {isSubscribed ? 'Current plan' : busy ? 'Redirecting…' : plan.cta}
              </Button>
            )}
          </Card>
        ))}
      </div>

      <p className="text-center text-xs leading-relaxed text-steel-500">
        Web billing via Stripe. Apple App Store builds will use In-App Purchase when that ships.{' '}
        <Link to="/privacy" className="text-tech-400 hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
