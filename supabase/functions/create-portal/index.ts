import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, createUserClient, getAuthedUser } from '../_shared/supabaseClients.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  if (!STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: 'stripe_not_configured', message: 'Stripe is not configured on the server.' },
      503,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const userClient = createUserClient(authHeader)
  const user = await getAuthedUser(userClient)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  let return_url = ''
  try {
    const body = await req.json()
    return_url = String(body.return_url ?? '')
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  if (!return_url) return jsonResponse({ error: 'missing_return_url' }, 400)

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.stripe_customer_id) {
    return jsonResponse(
      { error: 'no_customer', message: 'No billing customer on file. Upgrade to Pro first.' },
      400,
    )
  }

  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: profile.stripe_customer_id,
      return_url,
    }),
  })
  const portal = await portalRes.json()
  if (!portalRes.ok || !portal.url) {
    return jsonResponse({ error: 'stripe_portal_failed', message: portal.error?.message }, 502)
  }

  return jsonResponse({ url: portal.url })
})
