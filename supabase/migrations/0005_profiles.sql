-- IronMedic — user profiles + free-tier enforcement (Section 8, Security note).
-- A "profile" row is created automatically for every new auth user. This is
-- the server-side source of truth for subscription status — the free-tier
-- diagnosis cap is enforced by the Edge Function reading `is_subscribed`
-- here, never trusted to client-side state.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_subscribed boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

-- No insert/update/delete policies for regular users — profiles are managed
-- by the handle_new_user trigger (SECURITY DEFINER) and, later, the Stripe
-- webhook Edge Function using the service role key.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Free-tier limit is intentionally a plain constant read by the Edge
-- Function (FREE_DIAGNOSIS_LIMIT env var), not stored in the DB — there is
-- nothing here to bypass client-side since the count itself is computed
-- server-side from `diagnoses`, which is RLS-protected per user.
