import { supabase } from './supabase'
import { appPath } from './appUrl'
import type { SubscriptionTier } from './subscription'

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) throw new Error('Missing VITE_SUPABASE_URL')
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    'Content-Type': 'application/json',
  }
}

/** Starts Stripe Checkout for Pro or Premium. */
export async function startCheckout(tier: Exclude<SubscriptionTier, 'free'>): Promise<{
  url: string
  upgraded?: boolean
}> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const headers = await authHeaders()
  const res = await fetch(`${base}/functions/v1/create-checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tier,
      success_url: appPath('/account?checkout=success'),
      cancel_url: appPath('/pricing?checkout=cancel'),
    }),
  })
  const json = (await res.json()) as {
    url?: string
    upgraded?: boolean
    error?: string
    message?: string
  }
  if (!res.ok || !json.url) {
    throw new Error(json.message || json.error || `Checkout failed (${res.status})`)
  }
  return { url: json.url, upgraded: json.upgraded }
}

/** @deprecated Use startCheckout('pro') */
export async function startProCheckout(): Promise<string> {
  const { url } = await startCheckout('pro')
  return url
}

/** Opens Stripe Customer Portal for managing / canceling the subscription. */
export async function openBillingPortal(): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const headers = await authHeaders()
  const res = await fetch(`${base}/functions/v1/create-portal`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      return_url: appPath('/account'),
    }),
  })
  const json = (await res.json()) as { url?: string; error?: string; message?: string }
  if (!res.ok || !json.url) {
    throw new Error(json.message || json.error || `Billing portal failed (${res.status})`)
  }
  return json.url
}

export async function fetchProfile(): Promise<{
  is_subscribed: boolean
  subscription_tier: SubscriptionTier
  stripe_customer_id: string | null
} | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('is_subscribed, subscription_tier, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as {
    is_subscribed: boolean
    subscription_tier: SubscriptionTier
    stripe_customer_id: string | null
  } | null
}
