# Supabase Auth — password reset on iOS

Password reset emails must use **token_hash** links (not PKCE `?code=` links). PKCE fails when the reset is requested in the app but the link opens in Mail/Safari.

IronMedic sends reset emails via the `request-password-reset` Edge Function (Resend) with a direct `token_hash` link.

## Option A — Resend (recommended)

1. Create a free [Resend](https://resend.com) account and API key.
2. Set Supabase secrets:
   ```bash
   npx supabase secrets set RESEND_API_KEY=re_...
   npx supabase secrets set RESEND_FROM="IronMedic <onboarding@resend.dev>"
   npx supabase secrets set APP_URL=https://ironmedic.vercel.app
   ```
   (`onboarding@resend.dev` only sends to your Resend account email until you verify a domain.)
3. Deploy the function:
   ```bash
   npx supabase functions deploy request-password-reset
   ```

## Option B — Custom SMTP in Supabase + email template

Free-tier Supabase blocks editing email templates until you add custom SMTP.

1. Dashboard → **Authentication** → **SMTP** → enable custom SMTP (Resend SMTP credentials work).
2. **Email Templates** → **Reset password** → paste from `supabase/templates/recovery.html`:
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
   ```
3. **URL Configuration**:
   - **Site URL:** `https://ironmedic.vercel.app`
   - **Redirect URLs:** `https://ironmedic.vercel.app/**`

## After setup

Request a **new** reset from the app or https://ironmedic.vercel.app/login. Old PKCE emails will not work.

The link opens `/auth/confirm`, verifies via `verifyOtp`, then the new-password screen.
