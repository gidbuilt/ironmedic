import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { applyVerifiedAppleTransaction } from '../_shared/appleEntitlements.ts'
import { isAppleEntitlementActive, verifyAndDecodeTransaction } from '../_shared/appleJws.ts'
import { createServiceClient, createUserClient, getAuthedUser } from '../_shared/supabaseClients.ts'
import { tierFromAppleProductId } from '../_shared/applePlans.ts'
import { isPaidTier, tierRank, type SubscriptionTier } from '../_shared/subscription.ts'

function collectSignedTransactions(body: Record<string, unknown>): string[] {
  const many = body.signedTransactions
  const one = body.signedTransaction
  const out: string[] = []
  if (Array.isArray(many)) {
    for (const item of many) {
      if (typeof item === 'string' && item.includes('.')) out.push(item)
    }
  }
  if (typeof one === 'string' && one.includes('.')) out.push(one)
  return [...new Set(out)]
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const userClient = createUserClient(authHeader)
  const user = await getAuthedUser(userClient)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  if (user.is_anonymous) {
    return jsonResponse(
      {
        error: 'account_required',
        message: 'Create an account before starting your App Store trial.',
      },
      400,
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const signed = collectSignedTransactions(body)
  if (!signed.length) {
    return jsonResponse(
      {
        error: 'missing_signed_transaction',
        message: 'No App Store transaction was sent. Try Restore purchases.',
      },
      400,
    )
  }

  try {
    const verified = []
    for (const jws of signed) {
      verified.push(await verifyAndDecodeTransaction(jws))
    }

    const active = verified.filter((tx) => isAppleEntitlementActive(tx))
    const best = active.sort(
      (a, b) => tierRank(tierFromAppleProductId(b.productId)) - tierRank(tierFromAppleProductId(a.productId)),
    )[0]

    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('subscription_tier, billing_provider')
      .eq('id', user.id)
      .maybeSingle()

    const currentTier = (profile?.subscription_tier ?? 'free') as SubscriptionTier
    if (profile?.billing_provider === 'stripe' && isPaidTier(currentTier)) {
      return jsonResponse(
        {
          error: 'stripe_subscription_active',
          message: 'This account already has a web (Stripe) subscription. Manage it from Account on the website.',
        },
        400,
      )
    }

    if (!best) {
      if (profile?.billing_provider === 'apple') {
        await service
          .from('profiles')
          .update({ subscription_tier: 'free', is_subscribed: false })
          .eq('id', user.id)
      }
      return jsonResponse(
        {
          error: 'no_active_subscription',
          message: 'No active App Store subscription found for this Apple ID.',
          tier: 'free',
        },
        400,
      )
    }

    const result = await applyVerifiedAppleTransaction(service, {
      claimedUserId: user.id,
      transaction: best,
    })

    return jsonResponse({
      ok: true,
      tier: result.tier,
      upgraded: tierRank(result.tier) > tierRank(currentTier),
      environment: best.environment,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'verify_failed'
    console.error('verify-apple-purchase', message)
    if (message === 'stripe_subscription_active') {
      return jsonResponse(
        {
          error: 'stripe_subscription_active',
          message: 'This account already has a web (Stripe) subscription. Manage it from Account on the website.',
        },
        400,
      )
    }
    if (message === 'bundle_mismatch' || message === 'unknown_product' || message === 'untrusted_apple_root') {
      return jsonResponse({ error: message, message: 'App Store purchase could not be verified.' }, 400)
    }
    return jsonResponse(
      { error: 'verify_failed', message: 'Could not verify the App Store purchase. Try Restore purchases.' },
      400,
    )
  }
})
