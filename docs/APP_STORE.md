# IronMedic — App Store checklist

## Done in repo
- Capacitor iOS shell (`ios/`), bundle id `com.ironmedic.app`
- App icon: `public/icons/app-icon-1024.png` → Xcode AppIcon
- Camera / photo library usage strings in `ios/App/App/Info.plist`
- Privacy Policy page: `/privacy`
- Account deletion UI: `/account` + SQL `delete_own_account` migration
- StoreKit 2 subscriptions via `@capgo/native-purchases` (paywall uses IAP on iOS, Stripe on web)

## Your steps (Mac + Apple Developer)

1. **Apply DB migrations** (account delete RPC + Apple billing columns):
   ```bash
   npx supabase db push
   ```
2. **Enable Anonymous Auth** (if not already): Supabase → Authentication → Providers → Anonymous.
3. **Deploy Apple billing functions** (after `0015_apple_subscriptions.sql`):
   ```bash
   npx supabase functions deploy verify-apple-purchase apple-webhook
   ```
4. **Build & open Xcode** (syncs the Native Purchases plugin into the iOS project):
   ```bash
   npm run build:ios
   npm run open:ios
   ```
   In the Xcode target, confirm **In-App Purchase** is enabled (Signing & Capabilities). `npx cap sync ios` is required after adding/updating `@capgo/native-purchases`.
5. In Xcode: select your **Team** (signing), connected iPhone or simulator, Run.
6. **App Store Connect**: create app with bundle id `com.ironmedic.app`.
7. Set **Privacy Policy URL** to `https://ironmedic.vercel.app/privacy`.
8. Set **Support URL** to `https://ironmedic.vercel.app/support` (not the privacy page).
9. Archive → Upload → TestFlight → Submit for Review.

## Billing

- **Web:** Stripe Checkout — see [BILLING.md](./BILLING.md)
- **iOS:** StoreKit 2 auto-renewable subscriptions (7-day trial configured on the ASC products)

| Plan | App Store product ID | ASC price tier |
|------|----------------------|----------------|
| Basic | `com.ironmedic.app.basic.monthly` | $14.99 CAD / month |
| Pro | `com.ironmedic.app.pro.monthly` | $24.99 CAD / month |
| Premium | `com.ironmedic.app.premium.monthly` | $39.99 CAD / month |

Products already exist in App Store Connect (Prepare for Submission). Do not recreate them or invent Paid Apps Agreement / metadata changes.

After a purchase or Restore, the app posts the StoreKit 2 JWS to `verify-apple-purchase`, which sets `profiles.subscription_tier` the same way Stripe does. Point **App Store Server Notifications V2** (Production + Sandbox) at:

`https://<project-ref>.supabase.co/functions/v1/apple-webhook`

## Sandbox test (before Review)

1. App Store Connect → Users and Access → **Sandbox** → create a tester Apple ID.
2. On a device: Settings → Developer → Sandbox Account (or sign out of the Media & Purchases Apple ID). Do not use your real Apple ID.
3. Run a Debug/TestFlight build, create a real IronMedic account (not guest), open Pricing, buy Basic / Pro / Premium.
4. Confirm the Apple sheet shows a **7-day free trial**, then that Account shows the matching plan and Gus unlocks.
5. Use **Restore purchases** after a reinstall / new device.
6. Upgrade Basic → Pro (same subscription group). Cancel / failed payment: Account should return to No plan after the webhook or the next restore.
7. Confirm the website still uses Stripe Checkout (not StoreKit).

## First version that includes these IAPs

On the App Store Connect version you submit:

1. Attach all three auto-renewable subscriptions to the iOS version (they must be in the same subscription group for upgrades).
2. Confirm each product’s 7-day introductory offer is still set.
3. Privacy Policy + Support URLs as above. The in-app paywall links Privacy and Apple’s standard EULA (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`).
4. Review notes: “Subscriptions are auto-renewable monthly plans sold via StoreKit 2. Product IDs: com.ironmedic.app.basic.monthly, com.ironmedic.app.pro.monthly, com.ironmedic.app.premium.monthly. Sandbox: create an IronMedic account in the app, then subscribe from Pricing. Restore purchases is on Pricing and Account.”
5. Paid Apps Agreement / tax/banking must already be active (required for IAP to clear Ready to Submit). This repo does not change ASC legal agreements.

## Still needed before Review
- Hosted production URL for Privacy Policy (and preferably the web app)
- Deployed Edge Functions (`gus-chat`, Stripe functions, `verify-apple-purchase`, `apple-webhook`) against production Supabase
- **Supabase Auth URLs** (Dashboard → Authentication → URL Configuration):
  - **Site URL:** `https://ironmedic.vercel.app`
  - **Redirect URLs:** `https://ironmedic.vercel.app/**`
- App Store screenshots (6.7" and 6.1" iPhones)
- Support URL: `https://ironmedic.vercel.app/support`
