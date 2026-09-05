import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { isAppleEntitlementActive, type AppleTransaction } from './appleJws.ts'
import { tierFromAppleProductId } from './applePlans.ts'
import { isPaidTier, type SubscriptionTier } from './subscription.ts'

export type AppleApplyResult = {
  userId: string
  tier: SubscriptionTier
  isActive: boolean
}

type ProfileBilling = {
  id: string
  subscription_tier: string | null
  billing_provider: string | null
  apple_original_transaction_id: string | null
}

async function loadProfile(service: SupabaseClient, userId: string): Promise<ProfileBilling | null> {
  const { data } = await service
    .from('profiles')
    .select('id, subscription_tier, billing_provider, apple_original_transaction_id')
    .eq('id', userId)
    .maybeSingle()
  return (data as ProfileBilling | null) ?? null
}

export async function applyVerifiedAppleTransaction(
  service: SupabaseClient,
  params: {
    claimedUserId?: string | null
    transaction: AppleTransaction
  },
): Promise<AppleApplyResult> {
  const tx = params.transaction
  const isActive = isAppleEntitlementActive(tx)
  const entitledTier: SubscriptionTier = isActive ? tierFromAppleProductId(tx.productId) : 'free'

  let userId = params.claimedUserId ?? null
  if (!userId && tx.appAccountToken) {
    const byToken = await loadProfile(service, tx.appAccountToken)
    if (byToken) userId = byToken.id
  }
  if (!userId) {
    const { data } = await service
      .from('profiles')
      .select('id')
      .eq('apple_original_transaction_id', tx.originalTransactionId)
      .maybeSingle()
    userId = (data as { id?: string } | null)?.id ?? null
  }
  if (!userId) {
    throw new Error('no_linked_account')
  }

  const profile = await loadProfile(service, userId)
  if (!profile) throw new Error('profile_not_found')

  if (
    isActive &&
    profile.billing_provider === 'stripe' &&
    isPaidTier((profile.subscription_tier ?? 'free') as SubscriptionTier)
  ) {
    throw new Error('stripe_subscription_active')
  }

  const { data: previousOwners } = await service
    .from('profiles')
    .select('id, billing_provider')
    .eq('apple_original_transaction_id', tx.originalTransactionId)
    .neq('id', userId)

  for (const row of (previousOwners ?? []) as Array<{ id: string; billing_provider: string | null }>) {
    const patch: Record<string, unknown> = { apple_original_transaction_id: null }
    if (row.billing_provider === 'apple') {
      patch.billing_provider = null
      patch.subscription_tier = 'free'
      patch.is_subscribed = false
    }
    await service.from('profiles').update(patch).eq('id', row.id)
  }

  if (
    !isActive &&
    profile.billing_provider === 'stripe' &&
    isPaidTier((profile.subscription_tier ?? 'free') as SubscriptionTier)
  ) {
    return { userId, tier: profile.subscription_tier as SubscriptionTier, isActive: false }
  }

  await service
    .from('profiles')
    .update({
      apple_original_transaction_id: tx.originalTransactionId,
      billing_provider: 'apple',
      subscription_tier: entitledTier,
      is_subscribed: entitledTier !== 'free',
    })
    .eq('id', userId)

  return { userId, tier: entitledTier, isActive }
}

export function shouldRevokeOnNotification(notificationType: string): boolean {
  return (
    notificationType === 'EXPIRED' ||
    notificationType === 'REFUND' ||
    notificationType === 'REVOKE' ||
    notificationType === 'GRACE_PERIOD_EXPIRED'
  )
}
