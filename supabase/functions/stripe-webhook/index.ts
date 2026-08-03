import { createServiceClient } from '../_shared/supabaseClients.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Stripe-Signature: t=timestamp,v1=hmac
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k, v]
    }),
  )
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  const digest = [...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, '0')).join('')

  // timing-safe-ish compare
  if (digest.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < digest.length; i++) mismatch |= digest.charCodeAt(i) ^ signature.charCodeAt(i)
  return mismatch === 0
}

async function setSubscribed(userId: string, customerId: string | null, subscribed: boolean) {
  const service = createServiceClient()
  const patch: Record<string, unknown> = { is_subscribed: subscribed }
  if (customerId) patch.stripe_customer_id = customerId
  await service.from('profiles').update(patch).eq('id', userId)
}

async function userIdFromCustomer(customerId: string): Promise<string | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (data?.id) return data.id

  // Fallback: fetch customer metadata from Stripe
  if (!STRIPE_SECRET_KEY) return null
  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  })
  const customer = await res.json()
  return (customer.metadata?.supabase_user_id as string | undefined) ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const payload = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  if (STRIPE_WEBHOOK_SECRET) {
    const ok = await verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET)
    if (!ok) return new Response('invalid signature', { status: 400 })
  }

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const obj = event.data.object

  try {
    if (event.type === 'checkout.session.completed') {
      const userId =
        (obj.client_reference_id as string | undefined) ||
        ((obj.metadata as Record<string, string> | undefined)?.supabase_user_id ?? null)
      const customerId = typeof obj.customer === 'string' ? obj.customer : null
      if (userId) await setSubscribed(userId, customerId, true)
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const customerId = typeof obj.customer === 'string' ? obj.customer : null
      const status = String(obj.status ?? '')
      const active = status === 'active' || status === 'trialing'
      if (customerId) {
        const userId =
          ((obj.metadata as Record<string, string> | undefined)?.supabase_user_id ?? null) ||
          (await userIdFromCustomer(customerId))
        if (userId) await setSubscribed(userId, customerId, active)
      }
    }
  } catch (err) {
    console.error('stripe-webhook handler error', err)
    return new Response('handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
