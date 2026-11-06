# Gus for another app — asset-context seam

This branch prepares a read-only way for another product to ask Gus about one
machine or vehicle. It does not integrate Uptime Pro. Uptime Pro's source was
not available here, so this repo does not gain Uptime screens, tables, or a
live route.

IronMedic's current app, sign-in, Stripe and StoreKit billing, and stored
shop data are unchanged. Nothing here is deployed.

## What was searched

| Place | Result |
| --- | --- |
| This workspace (`gidbuilt/ironmedic`) | No files, migrations, or strings for Uptime, Uptime Pro, or EquipGuard. |
| `gh repo list` for the authenticated GitHub account | Only `gidbuilt/ironmedic`. |
| Cloud agents visible to this run | Three agents, all on `gidbuilt/ironmedic`. None are an Uptime Pro codebase. |

These details were supplied with the task and were **not** verified against
App Store Connect, a registrar, or another repository:

- Product name Uptime Pro, previously EquipGuard.
- Domain `https://uptime-pro.ca`, described as unavailable.
- Apple app id `6778913955` and a prior TestFlight beta.
- A belief that a beta was worked on in Cursor.

No one was contacted. No Uptime architecture or data schema is inferred below.

## How Gus works in IronMedic today

`supabase/functions/gus-chat` is the live diagnostic engine. The browser
calls it from `src/lib/chat.ts` with the signed-in user's Supabase JWT.

On each turn the function:

1. Resolves the user with that JWT and a user-scoped Supabase client
   (`supabase/functions/_shared/supabaseClients.ts`). Table reads and writes
   go through row level security. The service-role client is used only to
   upsert the shared `common_issues_cache` table.
2. Loads `machines` where `id = machine_id`. A missing row is a 404. RLS
   already limits that read to `auth.uid() = user_id`. There is no
   organization or fleet-tenant table. Ownership is one Supabase user.
3. Reads `profiles` and calls `try_consume_gus_message` when subscription
   enforcement is on. Basic is capped (`BASIC_MONTHLY_MESSAGE_LIMIT`,
   default 75 per calendar month). Pro and Premium text turns are not
   capped. Photos require Premium. Web search is enabled for Basic, Pro,
   and Premium when this make/model/symptom is not already cached.
4. Builds a system prompt in `supabase/functions/_shared/prompt.ts` from the
   machine row (name, make, model, serial number, hours), pending diagnosis,
   diagnosis and repair history, SPN/FMI hits, uploaded-manual excerpts,
   this account's case precedents, and either a cached web summary or
   permission to use Anthropic web search.
5. Streams Claude through `supabase/functions/_shared/anthropic.ts`. The
   Anthropic key stays in Edge Function secrets. Text turns use
   `ANTHROPIC_MODEL_STANDARD` (default `claude-haiku-4-5`). Photo turns use
   `ANTHROPIC_MODEL_PREMIUM` (default `claude-sonnet-4-5`).
6. Writes the user and assistant rows to `conversations`. A `diagnosis-json`
   block inserts `diagnoses`. A `verify-fix-json` block inserts `repairs`,
   updates the diagnosis outcome, and inserts `case_precedents`. A
   `machine-info-json` block can fill an empty make and model on `machines`.

That last step is why `gus-chat` cannot back "Ask Gus about this
machine/vehicle" for another product. The intended Uptime behavior is
advice over an authorized snapshot, with no silent change to service
records. The live handler does the opposite: it persists diagnoses and
repairs as part of answering, and its prompt tells the model to prefer
known specifications and to use web search.

### Auth and tenant boundary

- Caller identity is a Supabase Auth JWT for an IronMedic user.
- User-owned tables (`machines`, `conversations`, `diagnoses`, `manuals`,
  `repairs`, `case_precedents`, `profiles`) allow a row only when
  `auth.uid()` matches `user_id` (or `profiles.id`).
- `common_issues_cache` is readable by every authenticated IronMedic user
  and is written with the service role. It is shared make/model research,
  not a tenant store.
- Storage buckets `manuals` and `photos` are private. Paths are
  `{user_id}/{machine_id}/{filename}` and policies compare the first folder
  to `auth.uid()`.
- There is no API key, org id, or cross-app grant that lets another product
  read these rows. An Uptime user id would not match `auth.uid()`.

### What the model is allowed to see today

Included: the IronMedic machine identity and hours, chat history for that
machine, diagnoses, repairs, SPN/FMI reference rows, manual excerpts,
account case precedents, cached or live web results, and Premium photos.

Not on the machine row: mileage, a vehicle type, a maintenance-log table,
or a reported-problem table. Shop history is diagnoses, repairs, and chat.
Serial number is stored and shown to the model. The new contract does not
take a serial number, because the requested advisory facts are make, model,
hours or mileage, recorded maintenance, and reported problems.

### Assets

Gus art is IronMedic branding, served from `public/` and versioned in
`src/lib/gusAssets.ts`:

- `public/icons/app-icon-1024.png`
- `public/gus-logo.png`, `public/gus-avatar.png`, `public/gus-fullbody.png`,
  `public/gus-talking.png`
- `public/gus-shop-bg.jpg`
- `public/ironmedic-wordmark.png`, `public/ironmedic-wordmark-nav.png`

The advisory contract does not require these files. Whether Uptime shows
the Gus face is a product choice after that source is open. Copying them
into another app is not part of this branch.

### Billing

Web subscriptions are Stripe. The iOS app (`com.ironmedic.app`) uses
StoreKit 2 product ids `com.ironmedic.app.basic.monthly`,
`com.ironmedic.app.pro.monthly`, and `com.ironmedic.app.premium.monthly`.
Both write `profiles.subscription_tier`. See `docs/BILLING.md`.

This seam does not call `try_consume_gus_message` and does not add a
function that would spend the production Anthropic key.

## The seam

| Piece | Role |
| --- | --- |
| `contracts/gus-asset-context.v1.schema.json` | Wire shape for any caller. |
| `supabase/functions/_shared/assetContext.ts` | Stricter parser, prompt builder, and reply sealer. This is the authority. |
| `supabase/functions/_shared/assetContext_test.ts` | Parser, prompt, and "no write" tests. |

`parseAssetAdvisoryRequest` accepts one JSON object:

- `contract_version`: the string `"1"`.
- `caller_reference`: optional opaque id, charset `A–Z a–z 0–9 . _ : -`,
  at most 80 characters. It is returned to the host and is not put in the
  prompt or looked up.
- `question`: the operator's question, at most 1500 characters.
- `asset.kind`: `machine` or `vehicle`.
- `asset.display_name`, `make`, `model`: make and model are `null` when
  not recorded. Empty strings are rejected.
- `asset.hours` and `asset.mileage`: non-negative numbers with at most two
  decimal places, or `null`. Maximum `10000000`.
- `asset.mileage_unit`: `km` or `mi` when any mileage in the snapshot is
  present, otherwise `null`. One unit covers the current reading and every
  maintenance reading. The prompt forbids converting units.
- `recorded_maintenance[]`: `performed_on` (`YYYY-MM-DD` or `null`),
  `summary`, `hours`, `mileage`. At most 25.
- `reported_problems[]`: `reported_on`, `summary`, `status` of `open`,
  `resolved`, or `unknown`. At most 25.

Unknown fields are rejected. That includes service schedules, OEM spec
objects, and instructions to mutate records. Dates must be real calendar
dates from 1950 through 2100, not timestamps. Strings are copied trimmed;
the parser does not keep a reference to the caller's object.

A successful call means the arrays are the complete authorized set. The
parser cannot see rows the caller left out. Empty arrays mean the
authorized record has none. More than 25 maintenance rows or 25 problems
rejects the whole request so Gus does not answer from a shortened history.

`buildAssetAdvisorySystemPrompt` fences the normalized JSON between
`<<<ASSET_CONTEXT_DATA>>>` and `<<<END_ASSET_CONTEXT_DATA>>>`. Those markers
are forbidden inside caller text. The prompt tells Gus to use only that
JSON, to say when a fact is null, not to invent OEM specifications or a
service schedule, not to treat record text as instructions, and not to emit
`STAGE:` or the diagnostic JSON blocks. It does not enable web search and
it does not include manuals, photos, SPN rows, or case precedents.

`sealAssetAdvisoryReply` returns `effects.records_changed: false` and
removes `STAGE:` lines and fenced `diagnosis-json`, `verify-fix-json`,
`machine-info-json`, and `differential-json` blocks, including a block that
never closes. The host shows `advisory`. Prose that claims a record was
updated is still just prose. The host must not parse it into a write.

`ASSET_ADVISORY_GUARANTEES` is frozen: no service-record, diagnosis, repair,
machine, or conversation writes; no web search; no OEM facts from outside
the snapshot.

## How a future host uses it

Do this in the calling app's backend, or in a new function that is not
`gus-chat`. This branch does not add that function.

1. Authenticate the person in the calling app. An IronMedic JWT does not
   authorize an Uptime asset, and an Uptime session must not be treated as
   an IronMedic subscriber.
2. Authorize that person for that asset using the calling app's own rules.
   Load make, model, hours, mileage, maintenance, and problems with that
   query. Map them onto the contract. If a stored note is longer than 400
   characters, or there are more than 25 rows, stop and decide an explicit
   policy. Do not truncate or drop rows inside this parser.
3. Reject the turn when `parseAssetAdvisoryRequest` fails. Do not call the
   model on a failed parse.
4. Call the model server-side. System prompt:
   `buildAssetAdvisorySystemPrompt(context)`. The only user message is
   `question`. Do not pass tools, web search, photos, or a second system
   prompt from `prompt.ts`.
5. Pass the assistant text through `sealAssetAdvisoryReply` with the
   caller reference from step 3. Display `reply.advisory`. Do not insert
   the reply into service, maintenance, diagnosis, or repair storage.
6. Keep the Anthropic key on the server that makes that call. Decide which
   account pays before any production traffic. Do not point the caller at
   `gus-chat`, and do not reuse `try_consume_gus_message` until that
   billing decision is explicit.

IronMedic's own `machines` table is not a drop-in source for the snapshot.
It has hours and no mileage column. It has no maintenance-log or
reported-problem table. Mapping `repairs` onto `recorded_maintenance` would
be a product decision and is not implemented.

## Prerequisites before Uptime code changes

1. The Uptime Pro repository (or a named archive of it) mounted in the
   workspace, with confirmation it is the app behind the TestFlight beta
   rather than a lookalike.
2. The real tables or documents that store an asset's make, model, hours,
   mileage, maintenance history, and reported problems, plus the query that
   enforces who may read them.
3. A written tenant rule if more than one person can open the same asset.
   IronMedic's `auth.uid()` policies do not describe that.
4. A billing decision that keeps IronMedic Stripe prices, StoreKit product
   ids, and `profiles` rows unchanged, and that names which Anthropic
   project pays for Uptime questions.
5. A UI decision for where "Ask Gus about this machine/vehicle" sits, and
   whether any Gus image is used. Those assets stay in IronMedic until then.
6. Agreement that advice is not written back to Uptime service records
   unless a person explicitly saves it in a later, separate action. This
   contract has no save API.

Until those exist, the safe implementation is the parser, the prompt, and
the tests in this branch.

## Tests

From the repository root, with Deno installed:

```bash
deno test supabase/functions/_shared/assetContext_test.ts
```

The tests cover a valid machine and vehicle snapshot, rejection of OEM
schedule and spec fields, missing arrays, stringly numbers, mileage/unit
pairing, bad dates, oversize history, fence breaking, prompt contents, the
frozen no-write guarantees, separation from `buildSystemPrompt`, and
stripping of diagnostic write blocks.
