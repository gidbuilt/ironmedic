import { applyVerifiedAppleTransaction, shouldRevokeOnNotification } from '../_shared/appleEntitlements.ts'
import { verifyAndDecodeNotification } from '../_shared/appleJws.ts'
import { createServiceClient } from '../_shared/supabaseClients.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  let body: { signedPayload?: string }
  try {
    body = (await req.json()) as { signedPayload?: string }
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const signedPayload = body.signedPayload
  if (!signedPayload) {
    return new Response('missing signedPayload', { status: 400 })
  }

  try {
    const notification = await verifyAndDecodeNotification(signedPayload)
    if (!notification.transaction) {
      return Response.json({ received: true, ignored: 'no_transaction' })
    }

    const service = createServiceClient()

    const revoke = shouldRevokeOnNotification(notification.notificationType)
    const tx = revoke
      ? { ...notification.transaction, revocationDate: notification.transaction.revocationDate ?? Date.now() }
      : notification.transaction

    try {
      await applyVerifiedAppleTransaction(service, { transaction: tx })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'apply_failed'
      if (message === 'no_linked_account' || message === 'profile_not_found') {
        console.warn('apple-webhook no linked profile', notification.transaction.originalTransactionId)
        return Response.json({ received: true, ignored: 'no_linked_account' })
      }
      throw err
    }

    return Response.json({ received: true, notificationType: notification.notificationType })
  } catch (err) {
    console.error('apple-webhook handler error', err)
    return new Response('handler error', { status: 400 })
  }
})
