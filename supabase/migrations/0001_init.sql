-- IronMedic — Phase 1 schema
-- Foundation tables: machines, conversations, diagnoses, manuals, reference
-- codes, repairs, case_precedents, common_issues_cache.
--
-- Design note on the reference-code tables: the build brief describes a single
-- `spn_fmi_codes` table (spn, fmi, name, system, make). In practice an SPN
-- (the parameter, e.g. "Engine Coolant Temperature") and an FMI (the failure
-- mode, e.g. "data valid but above normal range") are orthogonal — the same
-- 0-31 FMI meanings apply to every SPN. Storing them as one denormalized
-- table would mean ~25 SPNs x 32 FMIs = 800 near-duplicate rows. Instead this
-- schema splits them into `spn_codes` (the parameter + system + nullable
-- `make` for the currently-empty OEM-proprietary slot from knowledge layer 3)
-- and `fmi_codes` (the universal 0-31 definitions from knowledge layer 2).
-- A specific fault is still "SPN + FMI", just joined at query time instead of
-- pre-multiplied in storage.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------
create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  make text not null,
  model text not null,
  serial_number text,
  hours numeric check (hours is null or hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists machines_user_id_idx on machines (user_id);

create trigger machines_set_updated_at
  before update on machines
  for each row execute function set_updated_at();

alter table machines enable row level security;

create policy "machines_select_own" on machines
  for select using (auth.uid() = user_id);
create policy "machines_insert_own" on machines
  for insert with check (auth.uid() = user_id);
create policy "machines_update_own" on machines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "machines_delete_own" on machines
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- conversations — chat turns, tagged with diagnostic stage + app mode
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  stage text check (
    stage is null or stage in ('verify', 'inspect', 'narrow', 'theory', 'test', 'diagnosis', 'verify_fix')
  ),
  mode text not null default 'repair' check (mode in ('repair', 'pre_purchase', 'routine')),
  photo_paths jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists conversations_machine_id_idx on conversations (machine_id, created_at);
create index if not exists conversations_user_id_idx on conversations (user_id);

alter table conversations enable row level security;

create policy "conversations_select_own" on conversations
  for select using (auth.uid() = user_id);
create policy "conversations_insert_own" on conversations
  for insert with check (auth.uid() = user_id);
create policy "conversations_update_own" on conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conversations_delete_own" on conversations
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- diagnoses — Stage 6 output, plus outcome tracking for Verify Fix (Stage 7)
-- ---------------------------------------------------------------------------
create sequence if not exists diagnoses_tag_seq;

create table if not exists diagnoses (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references conversations (id) on delete set null,
  tag_number text not null unique default ('IM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('diagnoses_tag_seq')::text, 5, '0')),
  summary text not null,
  safe_to_operate text not null check (safe_to_operate in ('yes', 'no', 'caution', 'unknown')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  ranked_causes jsonb not null default '[]',
  likely_parts jsonb not null default '[]',
  outcome text not null default 'pending' check (outcome in ('pending', 'fixed', 'not_fixed', 'no_fault_found')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists diagnoses_machine_id_idx on diagnoses (machine_id, created_at desc);
create index if not exists diagnoses_user_id_idx on diagnoses (user_id);
-- Powers the "any diagnosis older than ~48h with outcome still pending" sweep.
create index if not exists diagnoses_pending_followup_idx on diagnoses (created_at) where outcome = 'pending';

alter table diagnoses enable row level security;

create policy "diagnoses_select_own" on diagnoses
  for select using (auth.uid() = user_id);
create policy "diagnoses_insert_own" on diagnoses
  for insert with check (auth.uid() = user_id);
create policy "diagnoses_update_own" on diagnoses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "diagnoses_delete_own" on diagnoses
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- manuals — user-uploaded PDFs, text extracted client-side via pdf.js
-- ---------------------------------------------------------------------------
create table if not exists manuals (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  extracted_text text,
  extraction_status text not null default 'pending' check (
    extraction_status in ('pending', 'ok', 'empty_scanned_pdf', 'error')
  ),
  uploaded_at timestamptz not null default now()
);

create index if not exists manuals_machine_id_idx on manuals (machine_id);
create index if not exists manuals_user_id_idx on manuals (user_id);

alter table manuals enable row level security;

create policy "manuals_select_own" on manuals
  for select using (auth.uid() = user_id);
create policy "manuals_insert_own" on manuals
  for insert with check (auth.uid() = user_id);
create policy "manuals_update_own" on manuals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manuals_delete_own" on manuals
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- spn_codes / fmi_codes — knowledge layers 2 & 3 (shared reference data)
-- ---------------------------------------------------------------------------
create table if not exists spn_codes (
  spn integer not null,
  make text,
  name text not null,
  system text not null,
  description text,
  primary key (spn, make)
);

comment on column spn_codes.make is
  'NULL = universal SAE J1939 parameter. Non-null = OEM-proprietary SPN '
  '(520192-524287 range) — intentionally left empty until populated from a '
  'verified manufacturer source. Never fabricate rows here.';

alter table spn_codes enable row level security;

create policy "spn_codes_select_authenticated" on spn_codes
  for select using (auth.role() = 'authenticated');

create table if not exists fmi_codes (
  fmi integer primary key check (fmi between 0 and 31),
  description text not null,
  severity_hint text
);

alter table fmi_codes enable row level security;

create policy "fmi_codes_select_authenticated" on fmi_codes
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- repairs — Verify Fix (Stage 7) outcomes, feeds the failure-review loop
-- ---------------------------------------------------------------------------
create table if not exists repairs (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  diagnosis_id uuid references diagnoses (id) on delete set null,
  parts_replaced jsonb not null default '[]',
  verified_fix boolean,
  failure_type text check (failure_type is null or failure_type in ('ruled_out', 'process_error')),
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists repairs_machine_id_idx on repairs (machine_id);
create index if not exists repairs_diagnosis_id_idx on repairs (diagnosis_id);
create index if not exists repairs_user_id_idx on repairs (user_id);

alter table repairs enable row level security;

create policy "repairs_select_own" on repairs
  for select using (auth.uid() = user_id);
create policy "repairs_insert_own" on repairs
  for insert with check (auth.uid() = user_id);
create policy "repairs_update_own" on repairs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "repairs_delete_own" on repairs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- case_precedents — the self-learning table (Section 6)
-- Scoped per-account for now (RLS = own user_id). Cross-user pooling requires
-- an anonymization design first; do not relax this policy before that exists.
-- ---------------------------------------------------------------------------
create table if not exists case_precedents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_machine_id uuid references machines (id) on delete set null,
  make text not null,
  model text not null,
  hours_range text,
  system text not null,
  symptom_summary text not null,
  root_cause text not null,
  confirming_test text,
  fix_applied text,
  verified_outcome boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists case_precedents_lookup_idx on case_precedents (user_id, make, model, system);

alter table case_precedents enable row level security;

create policy "case_precedents_select_own" on case_precedents
  for select using (auth.uid() = user_id);
create policy "case_precedents_insert_own" on case_precedents
  for insert with check (auth.uid() = user_id);
create policy "case_precedents_update_own" on case_precedents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "case_precedents_delete_own" on case_precedents
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- common_issues_cache — make+model level web-search cache (Section 4, item 5)
-- Shared across all users of the same make/model; written by the Edge
-- Function (service role) only, never directly by clients.
-- ---------------------------------------------------------------------------
create table if not exists common_issues_cache (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  symptom_keywords text not null,
  search_results_summary text not null,
  source_urls jsonb not null default '[]',
  cached_at timestamptz not null default now(),
  unique (make, model, symptom_keywords)
);

create index if not exists common_issues_cache_lookup_idx on common_issues_cache (make, model);

alter table common_issues_cache enable row level security;

create policy "common_issues_cache_select_authenticated" on common_issues_cache
  for select using (auth.role() = 'authenticated');
