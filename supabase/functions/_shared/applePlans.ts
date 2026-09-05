import type { SubscriptionTier } from './subscription.ts'

export type PaidTier = Exclude<SubscriptionTier, 'free'>

export const APPLE_BUNDLE_ID = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.ironmedic.app'

/** App Store Connect product IDs — must match ASC exactly. */
export const APPLE_PRODUCT_IDS: Record<PaidTier, string> = {
  basic: 'com.ironmedic.app.basic.monthly',
  pro: 'com.ironmedic.app.pro.monthly',
  premium: 'com.ironmedic.app.premium.monthly',
}

export function tierFromAppleProductId(productId: string | null | undefined): SubscriptionTier {
  if (!productId) return 'free'
  if (productId === APPLE_PRODUCT_IDS.premium) return 'premium'
  if (productId === APPLE_PRODUCT_IDS.pro) return 'pro'
  if (productId === APPLE_PRODUCT_IDS.basic) return 'basic'
  return 'free'
}

export function isKnownAppleProductId(productId: string): boolean {
  return (
    productId === APPLE_PRODUCT_IDS.basic ||
    productId === APPLE_PRODUCT_IDS.pro ||
    productId === APPLE_PRODUCT_IDS.premium
  )
}
