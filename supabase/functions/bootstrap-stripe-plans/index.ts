import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { PLAN_CAD_CENTS, fetchStripePrice, type PaidTier } from '../_shared/stripePlans.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const BOOTSTRAP_TOKEN = Deno.env.get('BOOTSTRAP_TOKEN') ?? ''

const PLANS: Array<{ tier: PaidTier; productName: string }> = [
  { tier: 'basic', productName: 'IronMedic Basic' },
  { tier: 'pro', productName: 'IronMedic Pro' },
  { tier: 'premium', productName: 'IronMedic Premium' },
]

async function stripePost(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe ${path} failed`)
  }
  return data
}

async function listActiveCadMonthlyPrices(): Promise<
  Array<{ id: string; unit_amount: number; product_name: string }>
> {
  const res = await fetch(
    'https://api.stripe.com/v1/prices?active=true&limit=100&expand[]=data.product',
    { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Failed to list Stripe prices')

  return (data.data ?? [])
    .filter(
      (p: { currency: string; recurring?: { interval: string }; unit_amount: number | null }) =>
        p.currency === 'cad' && p.recurring?.interval === 'month' && p.unit_amount != null,
    )
    .map((p: { id: string; unit_amount: number; product?: { name?: string } }) => ({
      id: p.id,
      unit_amount: p.unit_amount,
      product_name: p.product?.name ?? '',
    }))
}

async function findOrCreatePrice(tier: PaidTier, productName: string): Promise<string> {
  const cents = PLAN_CAD_CENTS[tier]
  const existing = (await listActiveCadMonthlyPrices()).find((p) => p.unit_amount === cents)
  if (existing) return existing.id

  const product = await stripePost('products', { name: productName })
  const price = await stripePost('prices', {
    product: product.id as string,
    currency: 'cad',
    unit_amount: String(cents),
    'recurring[interval]': 'month',
  })
  return price.id as string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  if (!STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'stripe_not_configured' }, 503)
  }

  const token = req.headers.get('x-bootstrap-token')
  if (!BOOTSTRAP_TOKEN || token !== BOOTSTRAP_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  try {
    const priceIds: Record<PaidTier, string> = {
      basic: await findOrCreatePrice('basic', 'IronMedic Basic'),
      pro: await findOrCreatePrice('pro', 'IronMedic Pro'),
      premium: await findOrCreatePrice('premium', 'IronMedic Premium'),
    }

    const verified: Record<string, string> = {}
    for (const tier of ['basic', 'pro', 'premium'] as PaidTier[]) {
      const id = priceIds[tier]
      const info = await fetchStripePrice(id, STRIPE_SECRET_KEY)
      verified[tier] = `${id} (${info.unitAmount / 100} ${info.currency.toUpperCase()}/mo — ${info.productName})`
    }

    return jsonResponse({
      ok: true,
      price_ids: priceIds,
      verified,
      next_steps: [
        'npx supabase secrets set STRIPE_PRICE_BASIC=' + priceIds.basic,
        'npx supabase secrets set STRIPE_PRICE_PRO=' + priceIds.pro,
        'npx supabase secrets set STRIPE_PRICE_PREMIUM=' + priceIds.premium,
        'npx supabase functions deploy create-checkout',
      ],
    })
  } catch (err) {
    console.error('bootstrap-stripe-plans', err)
    return jsonResponse(
      { error: 'bootstrap_failed', message: err instanceof Error ? err.message : 'Bootstrap failed' },
      500,
    )
  }
})
