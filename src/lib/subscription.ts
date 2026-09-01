export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'premium'

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

export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'basic' || tier === 'pro' || tier === 'premium'
}

export function canAttachPhotos(tier: SubscriptionTier): boolean {
  return tier === 'premium'
}

export function normalizeSubscriptionTier(value: string | null | undefined): SubscriptionTier {
  if (value === 'basic' || value === 'pro' || value === 'premium') return value
  return 'free'
}

/** Higher rank = more capable plan (used for upgrade/downgrade rules). */
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

function isCompTierActive(compTier: string | null | undefined, compExpiresAt: string | null | undefined): boolean {
  if (compTier !== 'basic' && compTier !== 'pro' && compTier !== 'premium') return false
  if (!compExpiresAt) return true
  return new Date(compExpiresAt) > new Date()
}

/** Best of Stripe subscription tier and active complimentary access. */
export function effectiveSubscriptionTier(
  subscriptionTier: SubscriptionTier,
  compTier: string | null | undefined,
  compExpiresAt: string | null | undefined,
): SubscriptionTier {
  if (!isCompTierActive(compTier, compExpiresAt)) return subscriptionTier
  const comp = normalizeSubscriptionTier(compTier)
  return tierRank(comp) > tierRank(subscriptionTier) ? comp : subscriptionTier
}

export function hasComplimentaryAccess(
  subscriptionTier: SubscriptionTier,
  compTier: string | null | undefined,
  compExpiresAt: string | null | undefined,
): boolean {
  if (!isCompTierActive(compTier, compExpiresAt)) return false
  const effective = effectiveSubscriptionTier(subscriptionTier, compTier, compExpiresAt)
  return isPaidTier(effective) && !isPaidTier(subscriptionTier)
}
