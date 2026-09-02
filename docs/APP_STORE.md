# IronMedic — App Store checklist

## Done in repo
- Capacitor iOS shell (`ios/`), bundle id `com.ironmedic.app`
- App icon: `public/icons/app-icon-1024.png` → Xcode AppIcon
- Camera / photo library usage strings in `ios/App/App/Info.plist`
- Privacy Policy page: `/privacy`
- Account deletion UI: `/account` + SQL `delete_own_account` migration

## Your steps (Mac + Apple Developer)

1. **Apply DB migration** (account delete RPC):
   ```bash
   npx supabase db push
   ```
2. **Enable Anonymous Auth** (if not already): Supabase → Authentication → Providers → Anonymous.
3. **Build & open Xcode**:
   ```bash
   npm run build:ios
   npm run open:ios
   ```
4. In Xcode: select your **Team** (signing), connected iPhone or simulator, Run.
5. **App Store Connect**: create app with bundle id `com.ironmedic.app`.
6. Set **Privacy Policy URL** to `https://ironmedic.vercel.app/privacy`.
7. Set **Support URL** to `https://ironmedic.vercel.app/support` (not the privacy page).
7. Archive → Upload → TestFlight → Submit for Review.

## Billing (web)
- Plans + Stripe Checkout wired — see [BILLING.md](./BILLING.md)
- iOS App Store still needs **In-App Purchase** before charging inside the native app

## Still needed before Review
- Hosted production URL for Privacy Policy (and preferably the web app)
- Deployed Edge Functions (`gus-chat`, Stripe functions) against production Supabase
- **Supabase Auth URLs** (Dashboard → Authentication → URL Configuration):
  - **Site URL:** `https://ironmedic.vercel.app`
  - **Redirect URLs:** `https://ironmedic.vercel.app/**`
- App Store screenshots (6.7" and 6.1" iPhones)
- If the iOS app charges money: Apple **In-App Purchase** (Stripe web checkout alone is not enough on iOS)
- Support URL: `https://ironmedic.vercel.app/support`
