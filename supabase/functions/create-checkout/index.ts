import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient, getAuthedUser } from '../_shared/supabaseClients.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO') ?? ''

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_PRO) {
    return jsonResponse(
      {
        error: 'stripe_not_configured',
        message:
          'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO as Edge Function secrets.',
      },
      503,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const userClient = createUserClient(authHeader)
  const user = await getAuthedUser(userClient)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  if (user.is_anonymous) {
    return jsonResponse(
      {
        error: 'account_required',
        message: 'Create a free account before upgrading to Pro.',
      },
      400,
    )
  }

  let success_url = ''
  let cancel_url = ''
  try {
    const body = await req.json()
    success_url = String(body.success_url ?? '')
    cancel_url = String(body.cancel_url ?? '')
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  if (!success_url || !cancel_url) {
    return jsonResponse({ error: 'missing_urls' }, 400)
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id, is_subscribed')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_subscribed) {
    return jsonResponse({ error: 'already_subscribed', message: 'You are already on Pro.' }, 400)
  }

  let customerId = profile?.stripe_customer_id as string | null

  if (!customerId) {
    const customerRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: user.email ?? '',
        'metadata[supabase_user_id]': user.id,
      }),
    })
    const customer = await customerRes.json()
    if (!customerRes.ok) {
      return jsonResponse({ error: 'stripe_customer_failed', message: customer.error?.message }, 502)
    }
    customerId = customer.id
    await service.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode: 'subscription',
      customer: customerId!,
      client_reference_id: user.id,
      success_url,
      cancel_url,
      'line_items[0][price]': STRIPE_PRICE_PRO,
      'line_items[0][quantity]': '1',
      'subscription_data[metadata][supabase_user_id]': user.id,
      'metadata[supabase_user_id]': user.id,
    }),
  })
  const session = await sessionRes.json()
  if (!sessionRes.ok || !session.url) {
    return jsonResponse({ error: 'stripe_checkout_failed', message: session.error?.message }, 502)
  }

  return jsonResponse({ url: session.url })
})
