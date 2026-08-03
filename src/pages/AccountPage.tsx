import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { openBillingPortal } from '../lib/billing'
import { FREE_DIAGNOSIS_LIMIT } from '../lib/plans'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

/**
 * Account: plan status, guest → email upgrade, billing portal, delete data.
 */
export function AccountPage() {
  const { user, isAnonymous, isSubscribed, refreshProfile, signOut, upgradeGuestAccount } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    const { error } = await upgradeGuestAccount(upgradeEmail.trim(), upgradePassword)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setUpgradeMsg('Account saved. Check your email if confirmation is required, then you can subscribe.')
  }

  async function handleBilling() {
    setBillingBusy(true)
    setError(null)
    try {
      const url = await openBillingPortal()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal.')
      setBillingBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-10">
      <Link to="/" className="text-sm text-steel-400 hover:text-steel-200">
        &larr; Back
      </Link>

      <Card accent="tech" className="space-y-4 p-6">
        <h1 className="text-xl font-semibold text-steel-50">Account</h1>
        <p className="text-sm text-steel-400">
          {isAnonymous
            ? 'You’re using IronMedic as a guest on this device.'
            : `Signed in as ${user?.email ?? 'your account'}.`}
        </p>

        <div className="rounded-xl border border-steel-700 bg-steel-900/80 px-4 py-3">
          <p className="font-mono text-[10px] tracking-widest text-steel-500 uppercase">Plan</p>
          <p className="mt-1 text-lg font-semibold text-steel-50">
            {isSubscribed ? 'Pro' : 'Free'}
            {!isSubscribed && (
              <span className="ml-2 text-sm font-normal text-steel-400">
                · {FREE_DIAGNOSIS_LIMIT} diagnoses included
              </span>
            )}
          </p>
          {params.get('checkout') === 'success' && (
            <p className="mt-1 text-sm text-safe-500">Payment received — Pro unlocks within a minute.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {!isSubscribed && (
              <Link to="/pricing">
                <Button className="min-h-10 px-4 py-2 text-sm">Upgrade to Pro</Button>
              </Link>
            )}
            {isSubscribed && (
              <Button
                variant="secondary"
                className="min-h-10 px-4 py-2 text-sm"
                disabled={billingBusy}
                onClick={() => void handleBilling()}
              >
                {billingBusy ? 'Opening…' : 'Manage billing'}
              </Button>
            )}
          </div>
        </div>

        {isAnonymous && (
          <form onSubmit={handleUpgradeGuest} className="space-y-3 border-t border-steel-800 pt-4">
            <p className="text-sm font-medium text-steel-200">Save this account</p>
            <p className="text-sm text-steel-500">
              Add email and password so your machines and chats stay with you — required before Pro
              checkout.
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
          <div className="border-t border-steel-800 pt-4">
            <Link to="/pricing" className="text-sm text-tech-400 hover:underline">
              View pricing →
            </Link>
          </div>
        )}

        <div className="space-y-2 border-t border-steel-800 pt-4">
          <p className="text-sm font-medium text-steel-200">Delete account &amp; data</p>
          <p className="text-sm text-steel-500">
            Removes your machines, chats, diagnoses, and uploaded manuals for this account.
          </p>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <Button variant="danger" disabled={busy} onClick={() => void deleteAccount()}>
            {busy ? 'Deleting…' : 'Delete my data'}
          </Button>
        </div>

        <p className="text-xs text-steel-500">
          See our{' '}
          <Link to="/privacy" className="text-tech-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Card>
    </div>
  )
}
