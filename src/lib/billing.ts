import { supabase } from './supabase'

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

/** Starts Stripe Checkout for Pro. Returns the hosted Checkout URL. */
export async function startProCheckout(): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const headers = await authHeaders()
  const res = await fetch(`${base}/functions/v1/create-checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      success_url: `${window.location.origin}/account?checkout=success`,
      cancel_url: `${window.location.origin}/pricing?checkout=cancel`,
    }),
  })
  const json = (await res.json()) as { url?: string; error?: string; message?: string }
  if (!res.ok || !json.url) {
    throw new Error(json.message || json.error || `Checkout failed (${res.status})`)
  }
  return json.url
}

/** Opens Stripe Customer Portal for managing / canceling the subscription. */
export async function openBillingPortal(): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const headers = await authHeaders()
  const res = await fetch(`${base}/functions/v1/create-portal`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      return_url: `${window.location.origin}/account`,
    }),
  })
  const json = (await res.json()) as { url?: string; error?: string; message?: string }
  if (!res.ok || !json.url) {
    throw new Error(json.message || json.error || `Billing portal failed (${res.status})`)
  }
  return json.url
}

export async function fetchProfile(): Promise<{ is_subscribed: boolean; stripe_customer_id: string | null } | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('is_subscribed, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
