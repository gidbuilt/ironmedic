import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { openBillingPortal } from '../lib/billing'
import { openExternalUrl } from '../lib/openExternalUrl'
import { BASIC_MONTHLY_MESSAGE_LIMIT } from '../lib/plans'
import { isNativeIos } from '../lib/platform'
import { manageAppleSubscriptions, restoreApplePurchases } from '../lib/appleIap'
import { tierLabel } from '../lib/subscription'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

/**
 * Account: plan status, guest → email upgrade, billing portal, delete data.
 */
export function AccountPage() {
  const { user, profile, isAnonymous, isSubscribed, subscriptionTier, isComplimentary, refreshProfile, signOut, upgradeGuestAccount } =
    useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iosBilling = isNativeIos()
  const billedByApple = profile?.billing_provider === 'apple'
  const [upgradeEmail, setUpgradeEmail] = useState('')
  const [upgradePassword, setUpgradePassword] = useState('')
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)

  useEffect(() => {
    if (params.get('checkout') !== 'success' || isSubscribed) return
    void refreshProfile()
    const id = window.setInterval(() => {
      void refreshProfile()
    }, 2000)
    const stop = window.setTimeout(() => window.clearInterval(id), 60_000)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [params, isSubscribed, refreshProfile])

  async function deleteAccount() {
    if (!user) return
    const ok = confirm(
      isAnonymous
        ? 'Clear this guest session and all machines/chats on this device?'
        : 'Permanently delete your IronMedic data for this account? This cannot be undone.',
    )
    if (!ok) return

    setBusy(true)
    setError(null)
    try {
      const { error: machinesError } = await supabase.from('machines').delete().eq('user_id', user.id)
      if (machinesError) throw new Error(machinesError.message)

      const { error: rpcError } = await supabase.rpc('delete_own_account')
      if (rpcError) console.warn('[account] delete_own_account', rpcError.message)

      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpgradeGuest(e: FormEvent) {
    e.preventDefault()
    setUpgradeMsg(null)
    setError(null)
    setBusy(true)
    try {
      const { error, needsEmailConfirmation } = await upgradeGuestAccount(upgradeEmail.trim(), upgradePassword)
      if (error) {
        setError(error)
        return
      }
      setUpgradeMsg(
        needsEmailConfirmation
          ? 'Account saved. Check your inbox to confirm your email, then sign in.'
          : 'Account saved — you’re signed in with your new credentials.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleBilling() {
    setBillingBusy(true)
    setError(null)
    try {
      if (iosBilling && billedByApple) {
        await manageAppleSubscriptions()
        setBillingBusy(false)
        return
      }
      const url = await openBillingPortal()
      await openExternalUrl(url)
      setBillingBusy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal.')
      setBillingBusy(false)
    }
  }

  async function handleRestore() {
    setRestoreBusy(true)
    setError(null)
    try {
      await restoreApplePurchases()
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore purchases.')
    } finally {
      setRestoreBusy(false)
    }
  }

  return (
    <div className="fade-up mx-auto min-h-0 max-w-lg flex-1 space-y-5 overflow-y-auto pb-6">
      <div className="space-y-1.5">
        <Link to="/" className="im-pill !px-2.5">
          ← Back
        </Link>
        <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-steel-50">Account</h1>
        <p className="text-[15px] text-steel-400">
          {isAnonymous
            ? 'You’re using IronMedic as a guest on this device.'
            : `Signed in as ${user?.email ?? 'your account'}.`}
        </p>
      </div>

      <Card accent="tech" className="space-y-5 p-6 sm:p-7">
        <div className="rounded-2xl border border-steel-700/80 bg-steel-950/50 px-4 py-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-steel-500 uppercase">Plan</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-steel-50">
            {tierLabel(subscriptionTier)}
            {isComplimentary && (
              <span className="ml-2 text-sm font-normal text-tech-400">· complimentary</span>
            )}
            {subscriptionTier === 'free' && !isComplimentary && (
              <span className="ml-2 text-sm font-normal text-steel-400">· trial not started</span>
            )}
            {subscriptionTier === 'basic' && (
              <span className="ml-2 text-sm font-normal text-steel-400">
                · {BASIC_MONTHLY_MESSAGE_LIMIT} diagnostics / month
              </span>
            )}
            {subscriptionTier === 'pro' && (
              <span className="ml-2 text-sm font-normal text-steel-400">· unlimited text</span>
            )}
          </p>
          {params.get('checkout') === 'success' && (
            <p className="mt-2 text-sm text-safe-500">Payment received — your plan unlocks within a minute.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!isSubscribed && (
              <Link to="/pricing">
                <Button size="sm">Start free trial</Button>
              </Link>
            )}
            {subscriptionTier === 'basic' && (
              <Link to="/pricing">
                <Button size="sm" variant="secondary">
                  Upgrade to Pro
                </Button>
              </Link>
            )}
            {subscriptionTier === 'pro' && (
              <Link to="/pricing">
                <Button size="sm" variant="secondary">
                  Upgrade to Premium
                </Button>
              </Link>
            )}
            {isSubscribed && user && (billedByApple || profile?.stripe_customer_id) && (
              <Button
                variant="secondary"
                size="sm"
                disabled={billingBusy || restoreBusy}
                onClick={() => void handleBilling()}
              >
                {billingBusy ? 'Opening…' : billedByApple ? 'Manage App Store subscription' : 'Manage billing'}
              </Button>
            )}
            {iosBilling && !isAnonymous && (
              <Button
                variant="secondary"
                size="sm"
                disabled={billingBusy || restoreBusy}
                onClick={() => void handleRestore()}
              >
                {restoreBusy ? 'Restoring…' : 'Restore purchases'}
              </Button>
            )}
          </div>
        </div>

        {isAnonymous && (
          <form onSubmit={handleUpgradeGuest} className="space-y-3 border-t border-steel-800/80 pt-5">
            <p className="text-sm font-semibold text-steel-100">Save this account</p>
            <p className="text-sm leading-relaxed text-steel-500">
              Add email and password so your machines and chats stay with you — required before a
              paid trial.
            </p>
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={upgradeEmail}
              onChange={(e) => setUpgradeEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={upgradePassword}
              onChange={(e) => setUpgradePassword(e.target.value)}
            />
            {upgradeMsg && <p className="text-sm text-safe-500">{upgradeMsg}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Saving…' : 'Create account from guest'}
            </Button>
          </form>
        )}

        {!isAnonymous && (
          <div className="border-t border-steel-800/80 pt-5">
            <Link to="/pricing" className="text-sm font-medium text-tech-400 hover:text-tech-300">
              View pricing →
            </Link>
          </div>
        )}

        <div className="space-y-2 border-t border-steel-800/80 pt-5">
          <p className="text-sm font-semibold text-steel-100">Delete account &amp; data</p>
          <p className="text-sm leading-relaxed text-steel-500">
            Removes your machines, chats, diagnoses, and uploaded manuals for this account.
          </p>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <Button variant="danger" size="sm" disabled={busy} onClick={() => void deleteAccount()}>
            {busy ? 'Deleting…' : 'Delete my data'}
          </Button>
        </div>

        <p className="text-xs text-steel-500">
          See our{' '}
          <Link to="/privacy" className="text-tech-400 hover:underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/support" className="text-tech-400 hover:underline">
            Support
          </Link>
          .
        </p>
      </Card>
    </div>
  )
}
