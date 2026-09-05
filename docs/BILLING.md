# IronMedic billing

Two storefronts, one entitlement: `profiles.subscription_tier` (`free` | `basic` | `pro` | `premium`). Gus unlocks from that column (plus complimentary `comp_tier`) regardless of who collected payment.

| Surface | Collector | When |
|---------|-----------|------|
| Web / non-iOS | Stripe Checkout + Customer Portal | Browser |
| Native iOS app | App Store / StoreKit 2 | Capacitor iOS (`com.ironmedic.app`) |

`profiles.billing_provider` is `stripe` or `apple` so the two systems do not overwrite each other.

## Plans

| Tier | Web (Stripe) | App Store (CAD tier) | What you get |
|------|--------------|----------------------|--------------|
| **Basic** | $14 CAD/mo | `com.ironmedic.app.basic.monthly` · $14.99 CAD/mo | 75 diagnostics/mo, live web intelligence, fleet |
| **Pro** | $24 CAD/mo | `com.ironmedic.app.pro.monthly` · $24.99 CAD/mo | Unlimited text, live web intelligence, fleet, manuals |
| **Premium** | $39 CAD/mo | `com.ironmedic.app.premium.monthly` · $39.99 CAD/mo | Everything in Pro + photo vision (Sonnet) |

There is **no free tier**. New subscribers get a **7-day free trial** (card in Stripe Checkout; Apple ID on iOS). Product IDs above must match App Store Connect exactly.

## AI models (Edge Function secrets)

- **Standard text** (all paid tiers, text-only turns): `ANTHROPIC_MODEL_STANDARD` — default `claude-haiku-4-5`
- **Vision** (Premium photo turns): `ANTHROPIC_MODEL_PREMIUM` — default `claude-sonnet-4-5`

## Usage limits

- Basic monthly cap: `BASIC_MONTHLY_MESSAGE_LIMIT` (default **75**), resets each calendar month
- Pro & Premium: unlimited text diagnostics
- Enforced in `try_consume_gus_message` (migrations `0011`, `0012`)

## One-time Stripe setup (web)

1. Apply migrations `0010`, `0011`, and `0012`.
2. In Stripe Dashboard → **Products**, create three recurring **monthly CAD** prices:
   - **Basic** — $14.00 CAD/month
   - **Pro** — $24.00 CAD/month
   - **Premium** — $39.00 CAD/month
3. Set Edge secrets (all three are required — copy each price ID from Stripe):

   | Secret | Plan | Amount |
   |--------|------|--------|
   | `STRIPE_PRICE_BASIC` | Basic | **$14.00 CAD / month** |
   | `STRIPE_PRICE_PRO` | Pro | **$24.00 CAD / month** |
   | `STRIPE_PRICE_PREMIUM` | Premium | **$39.00 CAD / month** |

   ```bash
   npx supabase secrets set STRIPE_PRICE_BASIC=price_...
   npx supabase secrets set STRIPE_PRICE_PRO=price_...
   npx supabase secrets set STRIPE_PRICE_PREMIUM=price_...
   npx supabase secrets set TRIAL_DAYS=7
   npx supabase secrets set BASIC_MONTHLY_MESSAGE_LIMIT=75
   npx supabase functions deploy create-checkout stripe-webhook gus-chat
   ```

   `create-checkout` verifies each price ID matches the table above. Wrong amounts show an error in the app instead of a misleading Checkout page.

## iOS App Store (StoreKit 2)

The native paywall uses `@capgo/native-purchases` (StoreKit 2). The client sends the signed transaction JWS to `verify-apple-purchase`, which pins the certificate chain to **Apple Root CA - G3**, checks `bundleId` = `com.ironmedic.app`, maps the product ID to a tier, and writes `subscription_tier`.

1. Apply migration `0015_apple_subscriptions.sql` (`npx supabase db push`).
2. Deploy the Apple functions:

   ```bash
   npx supabase functions deploy verify-apple-purchase apple-webhook
   ```

3. Optional secret (defaults to the iOS bundle id):

   ```bash
   npx supabase secrets set APPLE_BUNDLE_ID=com.ironmedic.app
   ```

4. In App Store Connect → your app → **App Store Server Notifications V2**, set Production and Sandbox URLs to:

   `https://<project-ref>.supabase.co/functions/v1/apple-webhook`

   That webhook verifies the signed payload the same way and updates renewals, expirations, refunds, and revokes. Products already exist in ASC (Prepare for Submission); do not recreate them.

Upgrades on iOS stay inside the same App Store subscription group (StoreKit handles the switch). Downgrades use **Manage subscriptions** (Settings → Apple ID → Subscriptions). Restore purchases re-sends current entitlements to `verify-apple-purchase`.

An account billed by Stripe cannot start a second App Store subscription (and vice versa) — that would double-charge. Manage the original storefront instead.

## Complimentary access (owner / demos)

Grant tier without Stripe or Apple on `profiles.comp_tier` + optional `comp_expires_at` (`NULL` = permanent). Stripe and Apple webhooks do not clear these fields. Apply migration `0014_comp_access.sql`.

```sql
-- Permanent Premium for your account (replace email):
update profiles
set comp_tier = 'premium', comp_expires_at = null
where id = (select id from auth.users where email = 'you@example.com');
```

Effective tier is the higher of billed `subscription_tier` and active comp access.

## Upgrades

- **Stripe:** Checkout supports upgrades only (Basic → Pro → Premium). Downgrades use the Stripe Customer Portal.
- **App Store:** Pricing CTA purchases the higher product via StoreKit. Downgrades use the App Store subscription sheet.
