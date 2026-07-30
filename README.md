# IronMedic

An AI-powered heavy equipment diagnostic platform. Gus — a 3D silverback
gorilla mechanic — diagnoses machines like a senior field technician: asking
intelligent follow-up questions, gathering evidence, and reasoning from
first principles instead of guessing.

This repo currently implements **Phase 1 — Foundation** and **Phase 2 —
Diagnostic Core**: Supabase schema, auth, machine profile CRUD, and a real,
Claude-backed 7-step diagnostic engine (Ask → Know the system → Narrow →
Targeted check → Conclusion → Confirm test → loop as needed, plus Verify
Fix after repair) with streaming chat, photo/manual ingestion,
case-precedent learning, and the active fix-verification loop.

## Stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS v4, React Router
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **AI orchestration:** Claude Messages API, called server-side only from a
  Supabase Edge Function (Deno) — never from the browser. Raw `fetch` + SSE
  parsing, no SDK dependency, so the wire protocol stays fully inspectable.
- **Design system:** dark charcoal/steel palette, safety-yellow accent
  reserved for CTAs/active states, IBM Plex Sans/Mono + Bebas Neue wordmark

## Project structure

```
src/
  components/        Shared UI (Layout, StageStepper, DiagnosisCard,
                      MessageBubble, ManualsSection, ProtectedRoute, ui/*)
  context/            AuthContext (Supabase session state)
  lib/                supabase client, machines/manuals/photos/diagnoses
                      data-access, chat.ts (streaming client), notifications.ts
  pages/              Route-level pages, incl. RepairChatPage, ServiceLogPage
  types/database.ts   Hand-authored types mirroring the SQL schema
supabase/
  migrations/         SQL migrations (schema, storage, reference-data seed,
                      profiles/free-tier)
  functions/
    gus-chat/          The diagnostic engine Edge Function
    _shared/            CORS, Supabase clients, Claude SSE client, the
                        7-stage system prompt builder, knowledge-layer
                        retrieval, response parsing, stream display filter
```

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com/dashboard), then grab
your project URL and anon key from **Project Settings → API**.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Both are safe to
ship to the browser — actual data protection comes from the Row Level
Security policies in the migrations, not from hiding these values. Never put
the Supabase **service role** key or the **Anthropic API key** in a `VITE_`
variable; those are server-side secrets for the Edge Function (below).

### 3. Run the database migrations

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you don't
have it, then link and push:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies, in order:

- `0001_init.sql` — all tables (`machines`, `conversations`, `diagnoses`,
  `manuals`, `spn_codes`, `fmi_codes`, `repairs`, `case_precedents`,
  `common_issues_cache`) with Row Level Security enabled and scoped to
  `auth.uid()` on every user-owned table
- `0002_storage.sql` — private `manuals` and `photos` Storage buckets with
  per-user RLS policies (path convention: `{user_id}/{machine_id}/{filename}`)
- `0003_seed_reference_data.sql` — seeds the ~25 universal J1939 SPNs and the
  full FMI 0–31 definitions (see note in that file about re-verifying against
  the official SAE spec before relying on it in production)
- `0004_profiles.sql` — a `profiles` row per user (created via an
  `auth.users` trigger), the source of truth for `is_subscribed`/free-tier
  enforcement
- `0005_diagnoses_system_column.sql` — adds `diagnoses.system` so the
  Verify Fix stage can write a complete `case_precedents` row without
  re-inferring which machine system was implicated

### 4. Deploy the Edge Function and set its secrets

```bash
npx supabase functions deploy gus-chat
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Optional secrets (all have sensible defaults):

| Secret | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Swap for a cheaper/faster model without a code change |
| `FREE_DIAGNOSIS_LIMIT` | `3` | Free diagnoses per account before the paywall response (HTTP 402) kicks in — real enforcement of this cap requires Stripe subscription wiring, which is Phase 6 |
| `ALLOWED_ORIGIN` | `*` | Lock CORS down to your deployed frontend origin in production |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
auto-injected into every Edge Function by Supabase — you don't set those
yourself.

If you have [Deno](https://deno.com/) installed locally, you can type-check
the function before deploying:

```bash
cd supabase/functions && deno check --config deno.json gus-chat/index.ts
```

### 5. Install dependencies and run

```bash
npm install
npm run dev
```

### 6. Enable email auth

In the Supabase dashboard under **Authentication → Providers**, email sign-up
is enabled by default. For local development you can disable "Confirm email"
under **Authentication → Settings** so you don't need a working SMTP setup
just to test sign-up.

## Deploy to Supabase (phone-friendly URL)

IronMedic runs entirely on Supabase: Postgres + Auth + Storage + Edge
Functions, with the Vite SPA published to a public Storage bucket so you can
open it from your phone.

### One-time setup

1. Create a project at [database.new](https://database.new) if you don't have one.
2. Copy API credentials into `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Create a personal access token at [Account → Tokens](https://supabase.com/dashboard/account/tokens)
   and add to `.env`:
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_...
   SUPABASE_PROJECT_REF=your-project-ref
   ```
4. Set Edge Function secrets (once per project):
   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   npx supabase secrets set AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=canadacentral
   npx supabase secrets set ALLOWED_ORIGIN=https://your-project-ref.supabase.co
   ```
   `gus-speak` needs Azure Speech for Gus voice; without it, chat still works but
   TTS falls back to the browser.

### Deploy

```bash
npm run deploy:supabase
```

This pushes migrations, deploys `gus-chat` and `gus-speak`, builds the SPA with
relative asset paths, and uploads `dist/` to the public `website` bucket.

**Your app URL** (bookmark this on your phone):

```
https://<project-ref>.supabase.co/storage/v1/object/public/website/index.html
```

After deploy, add that URL to **Authentication → URL Configuration → Redirect
URLs** in the Supabase dashboard so sign-up/login redirects work.

Backend-only deploy (skip website upload):

```bash
npm run deploy:supabase:backend
```

### GitHub Actions

The workflow at `.github/workflows/deploy-supabase.yml` runs the same deploy on
every push to `master`. Add these repository secrets:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | CLI auth |
| `SUPABASE_PROJECT_REF` | Target project |
| `VITE_SUPABASE_URL` | Frontend build |
| `VITE_SUPABASE_ANON_KEY` | Frontend build |

Edge Function secrets stay in Supabase (not GitHub).

## Fast prompt-iteration loop

Tuning Gus's system prompt (`supabase/functions/_shared/prompt.ts`) doesn't
require a browser signup/login smoke test each time. `scripts/ask-gus.mjs`
logs in as a persistent local test user, ensures a scratch machine exists,
and by default wipes that machine's conversation history first so every run
tests a clean "first message" — then prints Gus's streamed reply straight to
the terminal along with a word count.

```bash
supabase functions deploy gus-chat   # after editing the prompt/shared code
node scripts/ask-gus.mjs "I have a John Deere 2154G mistracking left, forward and reverse."

# continue the same conversation instead of resetting it:
node scripts/ask-gus.mjs --continue "It's consistent every time, warm or cold."

# use a different scratch machine:
node scripts/ask-gus.mjs --machine "310L Loader" "some other symptom"
```

Credentials for the test user live in `.env.devtest` (gitignored, created
automatically with sane defaults on first run). This account and its scratch
machine are dev-only — never used against real user data.

## How the diagnostic engine works

`supabase/functions/gus-chat` is the entire diagnostic core. On every user
message it:

1. Verifies the caller's JWT and re-derives a Supabase client scoped to that
   user (`_shared/supabaseClients.ts`) — every DB read/write in the request
   goes through Row Level Security exactly as if the browser made it
   directly. The only exception is `common_issues_cache`, written with a
   service-role client since it's the one deliberately shared, non-per-user
   table.
2. Enforces the free-diagnosis cap (`FREE_DIAGNOSIS_LIMIT`) before starting a
   brand-new conversation on a machine, server-side — never trust the client
   for this.
3. Gathers every knowledge layer (`_shared/knowledge.ts`): this machine's own
   diagnosis/repair history, any outstanding unresolved diagnosis, SPN/FMI
   matches parsed from the message, manual excerpts (keyword-matched against
   client-extracted PDF text), this account's own case precedents, and a
   cached (or live, via Claude's `web_search` tool) commonly-reported-issues
   lookup.
4. Assembles a system prompt (`_shared/prompt.ts`) encoding Gus's personality,
   the strict one-stage-per-reply methodology, the loop-back and
   failed-fix/convergence rules, safety requirements, and the structured
   output contract, then streams the reply from Claude
   (`_shared/anthropic.ts`).
5. Strips the hidden `STAGE:<name>` marker and any trailing
   `` ```diagnosis-json ``` `` / `` ```verify-fix-json ``` `` block from what
   the user sees (`_shared/parseResponse.ts`, `_shared/streamFilter.ts`), and
   persists the clean message, plus a `diagnoses` or `repairs`/
   `case_precedents` row when the model reaches that stage, before sending
   the final `done` event.

The client (`src/lib/chat.ts`) talks to this function with a raw
authenticated `fetch`, not `supabase.functions.invoke`, specifically so it
can consume the response as a live stream instead of waiting for the whole
body — that's what gives the live-typing effect in `RepairChatPage`. The
stream is treated as cosmetic only: the final `done` event's parsed data is
always the source of truth that gets rendered (e.g. the `DiagnosisCard`).

## What's implemented (Phase 1 + Phase 2)

- Email/password auth, protected routes, machine CRUD (Phase 1)
- Full database schema with RLS on every user-owned table (Phase 1)
- The real 7-stage diagnostic chat (`/machines/:id/repair`): streaming
  responses, a stepper wired to the model's own reported stage, photo
  attachments (sent to Claude as image content blocks), quick-reply chips
- Manual upload with client-side `pdf.js` text extraction (lazy-loaded so it
  never bloats the main bundle) — flags scanned/image-only PDFs instead of
  silently uploading something Gus can't actually read
- Diagnosis cards (safe-to-operate badge, confidence, ranked causes, likely
  parts, safety disclaimer) with a copy/share plain-text report button
- The active fix-verification loop: Gus asks about any unresolved diagnosis
  first on the next visit to that machine; the Service Log page
  (`/machines/:id/log`) surfaces a standing "did that fix it?" prompt,
  highlighted once it's been open 48+ hours
- Best-effort in-app follow-up reminders via the browser Notification API
  (see limitation note below)
- The self-learning loop: every confirmed repair outcome (fixed or not)
  writes a `case_precedents` row, retrieved as supporting evidence on future
  diagnoses for that make/model
- Common-issues web search (Claude's native `web_search` tool), cached per
  make+model+symptom so repeat lookups don't re-trigger a live search
- Server-side free-tier diagnosis cap (paywall response, no billing yet)

## Known limitations / what's intentionally NOT built yet

- **True push notifications.** The 48-hour follow-up reminder
  (`src/lib/notifications.ts`) only fires while a tab is open to check —
  real background push needs a service worker, VAPID keys, and a push
  subscription table, which is a meaningfully bigger scope than a web MVP
  warrants right now. Documented here rather than overclaiming.
- Voice (browser STT/TTS) and the 3D avatar — **Phases 3–4**
- Deterministic confidence scoring and `failure_type` (`ruled_out` vs.
  `process_error`) classification on `repairs` — currently left `null` for
  periodic human/model review, per the build brief — **Phase 5**
- Stripe subscription tiers actually backing `profiles.is_subscribed` — the
  cap-enforcement mechanism exists (Section above), but every account is
  unsubscribed until Stripe is wired — **Phase 6**
- Full checklist logic for Pre-Purchase and Routine Inspection modes (still
  "Coming soon" stubs)
- OEM-proprietary SPN codes (`spn_codes.make IS NOT NULL`) — intentionally
  left empty until sourced from a verified manufacturer spec; never
  fabricated

## Security notes

- The Anthropic API key lives only in the Edge Function's secrets — it is
  never sent to or reachable from the browser.
- Every table query the Edge Function makes on behalf of a user goes through
  a JWT-scoped Supabase client, so Row Level Security applies identically to
  server-side and client-side requests. Only the shared
  `common_issues_cache` table is written with the service-role key.
- Photos and manuals live in Supabase Storage (private buckets, per-user RLS
  paths), never as base64 blobs in Postgres rows.
- The free-tier cap is checked server-side in the Edge Function, not just
  hidden in the UI.
