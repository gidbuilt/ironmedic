import { handleCors, jsonResponse } from '../_shared/cors.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const BOOTSTRAP_TOKEN = Deno.env.get('BOOTSTRAP_TOKEN') ?? ''

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe GET ${path} failed`)
  return data as Record<string, unknown>
}

async function cancelSubscription(subscriptionId: string): Promise<void> {
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Failed to cancel ${subscriptionId}`)
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  if (!STRIPE_SECRET_KEY) return jsonResponse({ error: 'stripe_not_configured' }, 503)

  const token = req.headers.get('x-bootstrap-token')
  if (!BOOTSTRAP_TOKEN || token !== BOOTSTRAP_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  let email = 'gid.osborn@gmail.com'
  try {
    const body = await req.json()
    if (body.email) email = String(body.email).trim().toLowerCase()
  } catch {
    // default email
  }

  try {
    const customers = await stripeGet(
      `customers?email=${encodeURIComponent(email)}&limit=10`,
    )
    const customerList = (customers.data as Array<{ id: string }>) ?? []
    if (customerList.length === 0) {
      return jsonResponse({ ok: true, cancelled: [], message: 'No Stripe customer found for that email.' })
    }

    const cancelled: string[] = []
    for (const customer of customerList) {
      for (const status of ['active', 'trialing'] as const) {
        const subs = await stripeGet(
          `subscriptions?customer=${encodeURIComponent(customer.id)}&status=${status}&limit=20&expand[]=data.items.data.price`,
        )
        const subList = (subs.data as Array<{
          id: string
          status: string
          items?: { data?: Array<{ price?: { unit_amount?: number; id?: string } }> }
        }>) ?? []

        for (const sub of subList) {
          const amount = sub.items?.data?.[0]?.price?.unit_amount
          const priceId = sub.items?.data?.[0]?.price?.id
          await cancelSubscription(sub.id)
          cancelled.push(
            `${sub.id} (${status}, ${amount != null ? `$${amount / 100} CAD` : 'unknown'}, price ${priceId ?? '?'})`,
          )
        }
      }
    }

    return jsonResponse({
      ok: true,
      email,
      cancelled,
      message:
        cancelled.length > 0
          ? 'Subscriptions cancelled immediately.'
          : 'No active or trialing subscriptions found.',
    })
  } catch (err) {
    console.error('stripe-cancel-subscriptions', err)
    return jsonResponse(
      { error: 'cancel_failed', message: err instanceof Error ? err.message : 'Cancel failed' },
      500,
    )
  }
})
