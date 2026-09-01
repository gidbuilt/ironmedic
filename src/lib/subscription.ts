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
