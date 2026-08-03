# IronMedic billing (Stripe)

## Plans
- **Free** — 3 diagnoses per account (`FREE_DIAGNOSIS_LIMIT`)
- **Pro** — $12 CAD/month, unlimited diagnoses (`profiles.is_subscribed = true`)

## One-time Stripe setup
1. Create a Stripe account → Product **IronMedic Pro** → recurring Price **$12 CAD/month**.
2. Copy the Price ID (`price_...`).
3. Set Edge secrets:
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   npx supabase secrets set STRIPE_PRICE_PRO=price_...
   ```
4. Deploy functions:
   ```bash
   npx supabase functions deploy create-checkout
   npx supabase functions deploy create-portal
   # Stripe cannot send a Supabase JWT — must disable gateway JWT checks
   npx supabase functions deploy stripe-webhook --no-verify-jwt
   npx supabase functions deploy gus-chat
   ```
   (`supabase/config.toml` sets `verify_jwt = false` for `stripe-webhook`.)
5. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy signing secret → `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
6. Stripe Customer Portal: enable in Dashboard (Settings → Billing → Customer portal).

## App routes
- `/pricing` — plan comparison + Upgrade
- `/account` — plan status, guest→email upgrade, manage billing, delete data
