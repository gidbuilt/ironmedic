# IronMedic billing (Stripe)

## Plans

| Tier | Price | What you get |
|------|-------|--------------|
| **Basic** | $14 CAD/mo | 75 diagnostics/mo, live web intelligence, fleet |
| **Pro** | $24 CAD/mo | Unlimited text, live web intelligence, fleet, manuals |
| **Premium** | $39 CAD/mo | Everything in Pro + photo vision (Sonnet) |

There is **no free tier**. New subscribers get a **7-day free trial** after adding a card in Stripe Checkout.

Paid tier is stored on `profiles.subscription_tier` (`free` = no active sub, `basic`, `pro`, `premium`).

## AI models (Edge Function secrets)

- **Standard text** (all paid tiers, text-only turns): `ANTHROPIC_MODEL_STANDARD` — default `claude-haiku-4-5`
- **Vision** (Premium photo turns): `ANTHROPIC_MODEL_PREMIUM` — default `claude-sonnet-4-5`

## Usage limits

- Basic monthly cap: `BASIC_MONTHLY_MESSAGE_LIMIT` (default **75**), resets each calendar month
- Pro & Premium: unlimited text diagnostics
- Enforced in `try_consume_gus_message` (migrations `0011`, `0012`)

## One-time Stripe setup

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

## Complimentary access (owner / demos)

Grant tier without Stripe on `profiles.comp_tier` + optional `comp_expires_at` (`NULL` = permanent). Stripe webhooks do not clear these fields. Apply migration `0014_comp_access.sql`.

```sql
-- Permanent Premium for your account (replace email):
update profiles
set comp_tier = 'premium', comp_expires_at = null
where id = (select id from auth.users where email = 'you@example.com');
```

Effective tier is the higher of Stripe `subscription_tier` and active comp access.

## Upgrades

Checkout supports upgrades only (Basic → Pro → Premium). Downgrades use the Stripe Customer Portal.
