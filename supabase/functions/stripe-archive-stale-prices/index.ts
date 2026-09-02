import { handleCors, jsonResponse } from '../_shared/cors.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const BOOTSTRAP_TOKEN = Deno.env.get('BOOTSTRAP_TOKEN') ?? ''
const CURRENT_PRO = Deno.env.get('STRIPE_PRICE_PRO') ?? ''

async function listCadMonthlyPrices(): Promise<
  Array<{ id: string; unit_amount: number; product_name: string; active: boolean }>
> {
  const res = await fetch(
    'https://api.stripe.com/v1/prices?limit=100&expand[]=data.product',
    { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Failed to list prices')

  return (data.data ?? [])
    .filter(
      (p: {
        currency: string
        recurring?: { interval: string }
        unit_amount: number | null
        active: boolean
      }) => p.currency === 'cad' && p.recurring?.interval === 'month' && p.unit_amount != null,
    )
    .map((p: { id: string; unit_amount: number; active: boolean; product?: { name?: string } }) => ({
      id: p.id,
      unit_amount: p.unit_amount,
      active: p.active,
      product_name: p.product?.name ?? '',
    }))
}

async function archivePrice(priceId: string): Promise<void> {
  const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ active: 'false' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Failed to archive ${priceId}`)
}

async function archiveProduct(productId: string): Promise<void> {
  const res = await fetch(`https://api.stripe.com/v1/products/${encodeURIComponent(productId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ active: 'false' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Failed to archive product ${productId}`)
}

async function fetchPrice(priceId: string): Promise<{ product_id: string }> {
  const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Failed to fetch price')
  return { product_id: data.product as string }
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

  try {
    const prices = await listCadMonthlyPrices()
    const stale = prices.filter(
      (p) =>
        p.active &&
        p.unit_amount === 1200 &&
        p.product_name.toLowerCase().includes('pro') &&
        p.id !== CURRENT_PRO,
    )

    const archived: string[] = []
    for (const p of stale) {
      try {
        await archivePrice(p.id)
        archived.push(`price ${p.id} (${p.unit_amount / 100} CAD/mo — ${p.product_name})`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (!message.includes('default price')) throw err
        const { product_id } = await fetchPrice(p.id)
        await archiveProduct(product_id)
        archived.push(
          `product ${product_id} + $${p.unit_amount / 100} price (${p.product_name}) — archived whole product`,
        )
      }
    }

    return jsonResponse({
      ok: true,
      archived,
      message:
        archived.length > 0
          ? 'Old prices archived (Stripe keeps them for history but they cannot be used for new checkouts).'
          : 'No matching $12 IronMedic Pro price found to archive.',
    })
  } catch (err) {
    console.error('stripe-archive-stale-prices', err)
    return jsonResponse(
      { error: 'archive_failed', message: err instanceof Error ? err.message : 'Archive failed' },
      500,
    )
  }
})
