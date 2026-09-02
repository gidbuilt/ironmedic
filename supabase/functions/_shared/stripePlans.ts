import type { SubscriptionTier } from './subscription.ts'
import { tierLabel } from './subscription.ts'

export type PaidTier = Exclude<SubscriptionTier, 'free'>

/** Expected monthly amounts in cents (CAD). Must match Stripe price IDs in secrets. */
export const PLAN_CAD_CENTS: Record<PaidTier, number> = {
  basic: 1400,
  pro: 2400,
  premium: 3900,
}

export function stripePriceSecretName(tier: PaidTier): string {
  switch (tier) {
    case 'premium':
      return 'STRIPE_PRICE_PREMIUM'
    case 'pro':
      return 'STRIPE_PRICE_PRO'
    case 'basic':
      return 'STRIPE_PRICE_BASIC'
  }
}

export async function fetchStripePrice(
  priceId: string,
  secretKey: string,
): Promise<{ unitAmount: number; currency: string; productName: string }> {
  const res = await fetch(
    `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Failed to fetch Stripe price')
  }
  return {
    unitAmount: data.unit_amount as number,
    currency: data.currency as string,
    productName: (data.product?.name as string) ?? 'IronMedic',
  }
}

export function formatCadCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} CAD`
}

export async function validateStripePriceForTier(
  priceId: string,
  tier: PaidTier,
  secretKey: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!priceId) {
    return {
      ok: false,
      message: `${tierLabel(tier)} billing is not configured. Set ${stripePriceSecretName(tier)} in Supabase Edge Function secrets.`,
    }
  }

  try {
    const stripePrice = await fetchStripePrice(priceId, secretKey)
    const expected = PLAN_CAD_CENTS[tier]
    if (stripePrice.currency !== 'cad') {
      return {
        ok: false,
        message: `${tierLabel(tier)} Stripe price must be CAD (got ${stripePrice.currency.toUpperCase()}). Update ${stripePriceSecretName(tier)}.`,
      }
    }
    if (stripePrice.unitAmount !== expected) {
      return {
        ok: false,
        message: `${tierLabel(tier)} is mapped to ${formatCadCents(stripePrice.unitAmount)} in Stripe but should be ${formatCadCents(expected)}. Update ${stripePriceSecretName(tier)} in Supabase secrets.`,
      }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Could not verify Stripe price.',
    }
  }
}
