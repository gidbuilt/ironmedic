# IronMedic billing (Stripe)

## Plans

| Tier | Price | What you get |
|------|-------|--------------|
| **Basic** | $14 CAD/mo | 75 diagnostics/mo, live web intelligence, fleet |
| **Pro** | $24 CAD/mo | Unlimited text, live web intelligence, fleet, manuals |
| **Premium** | $39 CAD/mo | Everything in Pro + photo/video vision (Sonnet) |

There is **no free tier**. New subscribers get a **7-day free trial** after adding a card in Stripe Checkout.

Paid tier is stored on `profiles.subscription_tier` (`free` = no active sub, `basic`, `pro`, `premium`).

## AI models (Edge Function secrets)

- **Standard text** (all paid tiers, text-only turns): `ANTHROPIC_MODEL_STANDARD` — default `claude-haiku-4-20250514`
- **Vision** (Premium photo turns): `ANTHROPIC_MODEL_PREMIUM` — default `claude-sonnet-4-20250514`

## Usage limits

- Basic monthly cap: `BASIC_MONTHLY_MESSAGE_LIMIT` (default **75**), resets each calendar month
- Pro & Premium: unlimited text diagnostics
- Enforced in `try_consume_gus_message` (migrations `0011`, `0012`)

## One-time Stripe setup

1. Create three recurring prices in Stripe:
   - **Basic** — $14 CAD/month
   - **Pro** — $24 CAD/month
   - **Premium** — $39 CAD/month
2. Apply migrations `0010`, `0011`, and `0012`.
3. Set Edge secrets:
   ```bash
   npx supabase secrets set STRIPE_PRICE_BASIC=price_...
   npx supabase secrets set STRIPE_PRICE_PRO=price_...
   npx supabase secrets set STRIPE_PRICE_PREMIUM=price_...
   npx supabase secrets set TRIAL_DAYS=7
   npx supabase secrets set BASIC_MONTHLY_MESSAGE_LIMIT=75
   ```
4. Deploy `create-checkout`, `stripe-webhook`, and `gus-chat`.

## Upgrades

Checkout supports upgrades only (Basic → Pro → Premium). Downgrades use the Stripe Customer Portal.
