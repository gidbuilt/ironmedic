import type { PlanId } from './plans'
import type { SubscriptionTier } from './subscription'

/** App Store Connect product IDs — must match ASC exactly. */
export const APPLE_PRODUCT_IDS = {
  basic: 'com.ironmedic.app.basic.monthly',
  pro: 'com.ironmedic.app.pro.monthly',
  premium: 'com.ironmedic.app.premium.monthly',
} as const satisfies Record<PlanId, string>

export const APPLE_PRODUCT_ID_LIST: string[] = [
  APPLE_PRODUCT_IDS.basic,
  APPLE_PRODUCT_IDS.pro,
  APPLE_PRODUCT_IDS.premium,
]

/** Apple price-tier copy when StoreKit has not returned a localized price yet. */
export const APPLE_PRICE_LABELS: Record<PlanId, string> = {
  basic: '$14.99',
  pro: '$24.99',
  premium: '$39.99',
}

export function planIdFromAppleProductId(productId: string): PlanId | null {
  if (productId === APPLE_PRODUCT_IDS.premium) return 'premium'
  if (productId === APPLE_PRODUCT_IDS.pro) return 'pro'
  if (productId === APPLE_PRODUCT_IDS.basic) return 'basic'
  return null
}

export function appleProductIdForPlan(plan: PlanId): string {
  return APPLE_PRODUCT_IDS[plan]
}

export function tierFromAppleProductId(productId: string | null | undefined): SubscriptionTier {
  return planIdFromAppleProductId(productId ?? '') ?? 'free'
}
