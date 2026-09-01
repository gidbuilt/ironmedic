export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'premium'

const STANDARD_MODEL = 'claude-haiku-4-20250514'
const PREMIUM_VISION_MODEL = 'claude-sonnet-4-20250514'

export function resolveClaudeModel(_tier: SubscriptionTier, hasImages: boolean): string {
  if (hasImages) {
    return Deno.env.get('ANTHROPIC_MODEL_PREMIUM') ?? PREMIUM_VISION_MODEL
  }
  return Deno.env.get('ANTHROPIC_MODEL_STANDARD') ?? STANDARD_MODEL
}

export function tierAllowsWebSearch(tier: SubscriptionTier): boolean {
  return tier === 'basic' || tier === 'pro' || tier === 'premium'
}

export function tierAllowsPhotos(tier: SubscriptionTier): boolean {
  return tier === 'premium'
}

export function tierLabel(tier: SubscriptionTier): string {
  switch (tier) {
    case 'premium':
      return 'Premium'
    case 'pro':
      return 'Pro'
    case 'basic':
      return 'Basic'
    default:
      return 'No plan'
  }
}

export function tierFromStripePrice(priceId: string | null | undefined): SubscriptionTier {
  if (!priceId) return 'free'
  const premium = Deno.env.get('STRIPE_PRICE_PREMIUM') ?? ''
  const pro = Deno.env.get('STRIPE_PRICE_PRO') ?? ''
  const basic = Deno.env.get('STRIPE_PRICE_BASIC') ?? ''
  if (premium && priceId === premium) return 'premium'
  if (pro && priceId === pro) return 'pro'
  if (basic && priceId === basic) return 'basic'
  // Unknown price but active subscription — treat as Pro for backward compatibility.
  return 'pro'
}

export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'basic' || tier === 'pro' || tier === 'premium'
}

export function tierRank(tier: SubscriptionTier): number {
  switch (tier) {
    case 'premium':
      return 3
    case 'pro':
      return 2
    case 'basic':
      return 1
    default:
      return 0
  }
}

function isCompTierActive(
  compTier: string | null | undefined,
  compExpiresAt: string | null | undefined,
): boolean {
  if (compTier !== 'basic' && compTier !== 'pro' && compTier !== 'premium') return false
  if (!compExpiresAt) return true
  return new Date(compExpiresAt) > new Date()
}

export function effectiveSubscriptionTier(
  subscriptionTier: SubscriptionTier,
  compTier: string | null | undefined,
  compExpiresAt: string | null | undefined,
): SubscriptionTier {
  if (!isCompTierActive(compTier, compExpiresAt)) return subscriptionTier
  const comp = compTier as SubscriptionTier
  return tierRank(comp) > tierRank(subscriptionTier) ? comp : subscriptionTier
}
