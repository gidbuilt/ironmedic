import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient, getAuthedUser } from '../_shared/supabaseClients.ts'
import { tierLabel, tierRank, type SubscriptionTier } from '../_shared/subscription.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_PRICE_BASIC = Deno.env.get('STRIPE_PRICE_BASIC') ?? ''
const STRIPE_PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO') ?? ''
const STRIPE_PRICE_PREMIUM = Deno.env.get('STRIPE_PRICE_PREMIUM') ?? ''
const TRIAL_DAYS = Number(Deno.env.get('TRIAL_DAYS') ?? '7')

function priceForTier(tier: SubscriptionTier): string {
  if (tier === 'premium') return STRIPE_PRICE_PREMIUM
  if (tier === 'pro') return STRIPE_PRICE_PRO
  return STRIPE_PRICE_BASIC
}

function parseTier(value: unknown): SubscriptionTier | null {
  if (value === 'basic' || value === 'pro' || value === 'premium') return value
  return null
}

async function findActiveSubscription(
  customerId: string,
): Promise<{ subscriptionId: string; itemId: string } | null> {
  for (const status of ['active', 'trialing'] as const) {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=${status}&limit=1`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    )
    const data = await res.json()
    const sub = data.data?.[0]
    const itemId = sub?.items?.data?.[0]?.id
    if (sub?.id && itemId) {
      return { subscriptionId: sub.id as string, itemId: itemId as string }
    }
  }
  return null
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_BASIC || !STRIPE_PRICE_PRO || !STRIPE_PRICE_PREMIUM) {
    return jsonResponse(
      {
        error: 'stripe_not_configured',
        message:
          'Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO, and STRIPE_PRICE_PREMIUM as Edge Function secrets.',
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
        message: 'Create an account before starting your free trial.',
      },
      400,
    )
  }

  let success_url = ''
  let cancel_url = ''
  let tier: SubscriptionTier = 'pro'
  try {
    const body = await req.json()
    success_url = String(body.success_url ?? '')
    cancel_url = String(body.cancel_url ?? '')
    const parsed = parseTier(body.tier)
    if (parsed) tier = parsed
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  if (!success_url || !cancel_url) {
    return jsonResponse({ error: 'missing_urls' }, 400)
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id, subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  const currentTier = (profile?.subscription_tier ?? 'free') as SubscriptionTier
  if (currentTier === tier) {
    return jsonResponse(
      { error: 'already_subscribed', message: `You are already on ${tierLabel(tier)}.` },
      400,
    )
  }
  if (tierRank(currentTier) > tierRank(tier)) {
    return jsonResponse(
      {
        error: 'downgrade_not_supported',
        message: 'Use billing portal to change or cancel your plan.',
      },
      400,
    )
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

  const priceId = priceForTier(tier)

  // Upgrade an existing subscription in-place (avoid duplicate Stripe subscriptions).
  if (currentTier !== 'free' && tierRank(tier) > tierRank(currentTier)) {
    const existing = await findActiveSubscription(customerId!)
    if (!existing) {
      return jsonResponse(
        {
          error: 'subscription_not_found',
          message: 'Could not find your active subscription. Use billing portal or contact support.',
        },
        400,
      )
    }

    const updateRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${existing.subscriptionId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'items[0][id]': existing.itemId,
          'items[0][price]': priceId,
          'metadata[tier]': tier,
          'metadata[supabase_user_id]': user.id,
          proration_behavior: 'create_prorations',
        }),
      },
    )
    const updated = await updateRes.json()
    if (!updateRes.ok) {
      return jsonResponse(
        { error: 'stripe_upgrade_failed', message: updated.error?.message ?? 'Upgrade failed' },
        502,
      )
    }

    await service
      .from('profiles')
      .update({ subscription_tier: tier, is_subscribed: true })
      .eq('id', user.id)

    return jsonResponse({ url: success_url, upgraded: true })
  }

  const eligibleForTrial = currentTier === 'free' && TRIAL_DAYS > 0
  const sessionParams: Record<string, string> = {
    mode: 'subscription',
    customer: customerId!,
    client_reference_id: user.id,
    success_url,
    cancel_url,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'subscription_data[metadata][supabase_user_id]': user.id,
    'subscription_data[metadata][tier]': tier,
    'metadata[supabase_user_id]': user.id,
    'metadata[tier]': tier,
  }
  if (eligibleForTrial) {
    sessionParams['subscription_data[trial_period_days]'] = String(TRIAL_DAYS)
  }

  const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(sessionParams),
  })
  const session = await sessionRes.json()
  if (!sessionRes.ok || !session.url) {
    return jsonResponse({ error: 'stripe_checkout_failed', message: session.error?.message }, 502)
  }

  return jsonResponse({ url: session.url })
})
