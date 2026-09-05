import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Product } from '@capgo/native-purchases'
import { useAuth } from '../context/AuthContext'
import { PLANS, TRIAL_DAYS, type Plan } from '../lib/plans'
import { startCheckout } from '../lib/billing'
import { openExternalUrl } from '../lib/openExternalUrl'
import { tierLabel, tierRank } from '../lib/subscription'
import { isNativeIos } from '../lib/platform'
import { APPLE_PRICE_LABELS } from '../lib/appleProducts'
import {
  AppleIapCancelledError,
  appleProductByPlan,
  loadAppleProducts,
  purchaseApplePlan,
  restoreApplePurchases,
} from '../lib/appleIap'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'

export function PricingPage() {
  const { user, isAnonymous, subscriptionTier, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busyTier, setBusyTier] = useState<'basic' | 'pro' | 'premium' | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storeProducts, setStoreProducts] = useState<Product[]>([])
  const cancelled = params.get('checkout') === 'cancel'
  const iosBilling = isNativeIos()
  const billedByApple = profile?.billing_provider === 'apple'
  const billedByStripe = profile?.billing_provider === 'stripe' && subscriptionTier !== 'free'

  useEffect(() => {
    if (!iosBilling) return
    let cancelledLoad = false
    void loadAppleProducts()
      .then((products) => {
        if (!cancelledLoad) setStoreProducts(products)
      })
      .catch((err) => {
        console.warn('[pricing] StoreKit products failed', err)
      })
    return () => {
      cancelledLoad = true
    }
  }, [iosBilling])

  function priceLabel(plan: Plan): string {
    if (!iosBilling) return plan.priceLabel
    const store = appleProductByPlan(storeProducts, plan.id)
    return store?.priceString ?? APPLE_PRICE_LABELS[plan.id]
  }

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
      setError(
        iosBilling
          ? 'Use Manage subscriptions to change to a lower plan. The change takes effect at the end of the current period.'
          : 'Use billing portal to change to a lower plan.',
      )
      return
    }

    if (iosBilling && billedByStripe) {
      setError('This account is billed on the web (Stripe). Manage or upgrade from Account on ironmedic.vercel.app.')
      return
    }

    setBusyTier(plan.id)
    try {
      if (iosBilling) {
        await purchaseApplePlan(plan.id, user.id)
        await refreshProfile()
        navigate('/account?checkout=success')
        return
      }
      const { url, upgraded } = await startCheckout(plan.id)
      if (upgraded) {
        navigate('/account?checkout=success')
        return
      }
      await openExternalUrl(url)
    } catch (err) {
      if (err instanceof AppleIapCancelledError) {
        setError(null)
        return
      }
      console.error('[pricing] checkout failed', err)
      setError(
        err instanceof Error
          ? err.message
          : iosBilling
            ? 'Could not complete the App Store purchase. Try Restore purchases or try again.'
            : 'Could not start checkout. Make sure Stripe is configured on the server.',
      )
    } finally {
      setBusyTier(null)
    }
  }

  async function handleRestore() {
    setError(null)
    if (!user || isAnonymous) {
      navigate(`/login?next=/pricing`)
      return
    }
    setRestoreBusy(true)
    try {
      await restoreApplePurchases()
      await refreshProfile()
      navigate('/account?checkout=success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore purchases.')
    } finally {
      setRestoreBusy(false)
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
          {iosBilling
            ? `Subscribe with your Apple ID — you won’t be charged until day ${TRIAL_DAYS + 1}. Basic for light use, Pro for unlimited text, Premium when Gus needs to see photos.`
            : `Add a card to start your trial — you won’t be charged until day ${TRIAL_DAYS + 1}. Basic for light use, Pro for unlimited text, Premium when Gus needs to see photos.`}
        </p>
      </div>

      {cancelled && (
        <Card className="border-caution-500/40 p-4 text-sm text-caution-500">
          Checkout canceled — you can start a trial anytime.
        </Card>
      )}
      {subscriptionTier !== 'free' && (
        <Card accent="tech" className="p-4 text-sm text-steel-200">
          You&apos;re on {tierLabel(subscriptionTier)}
          {billedByApple ? ' (App Store)' : billedByStripe ? ' (web billing)' : ''}.{' '}
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
          const stripeLock = iosBilling && billedByStripe
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
                <span className="text-3xl font-semibold tracking-tight text-steel-50">{priceLabel(plan)}</span>
                <span className="text-sm text-steel-500">{plan.priceDetail}</span>
              </p>
              <p className="mt-1 text-xs text-tech-400">
                {TRIAL_DAYS}-day free trial · {iosBilling ? 'Apple ID' : 'card required'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-steel-400">{plan.description}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-steel-200">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span className="mt-0.5 text-tech-400" aria-hidden>
                      ✓
                    </span>
                    <span>
                      {iosBilling && f.includes('card required') ? f.replace('card required', 'Apple ID') : f}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.id === 'premium' ? 'secondary' : plan.highlighted ? 'primary' : 'secondary'}
                disabled={Boolean(busyTier) || restoreBusy || isCurrent || isDowngrade || stripeLock}
                onClick={() => void handleStartTrial(plan)}
              >
                {isCurrent
                  ? 'Current plan'
                  : isDowngrade
                    ? iosBilling
                      ? 'Manage in App Store'
                      : 'Use billing portal'
                    : stripeLock
                      ? 'Manage on web'
                      : busy
                        ? iosBilling
                          ? 'Purchasing…'
                          : 'Redirecting…'
                        : plan.cta}
              </Button>
            </Card>
          )
        })}
      </div>

      {iosBilling && (
        <div className="flex flex-col items-center gap-3">
          <Button variant="secondary" disabled={Boolean(busyTier) || restoreBusy} onClick={() => void handleRestore()}>
            {restoreBusy ? 'Restoring…' : 'Restore purchases'}
          </Button>
          <p className="max-w-2xl text-center text-xs leading-relaxed text-steel-500">
            Payment is charged to your Apple ID at confirmation of purchase. The subscription automatically renews
            unless you cancel at least 24 hours before the end of the current period. Your account is charged for
            renewal within 24 hours prior to the end of the current period. Manage or cancel in Settings → Apple ID
            → Subscriptions.
          </p>
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-steel-500">
        Cancel before your trial ends to avoid charges.{' '}
        {iosBilling ? 'iOS billing via the App Store.' : 'Web billing via Stripe.'}{' '}
        <Link to="/privacy" className="text-tech-400 hover:underline">
          Privacy Policy
        </Link>
        {iosBilling && (
          <>
            {' · '}
            <a href={APPLE_EULA_URL} className="text-tech-400 hover:underline" target="_blank" rel="noreferrer">
              Terms of Use (EULA)
            </a>
          </>
        )}
      </p>
    </div>
  )
}
