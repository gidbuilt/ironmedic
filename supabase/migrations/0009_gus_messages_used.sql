-- Persistent Gus message usage — free-tier limit must survive chat/machine deletes.
-- Previously gus-chat counted rows in `conversations`, which reset when users
-- cleared chats or deleted machines.

alter table profiles
  add column if not exists gus_messages_used integer not null default 0
    check (gus_messages_used >= 0);

comment on column profiles.gus_messages_used is
  'Lifetime count of user messages sent to Gus. Monotonic — never decreased by deletes.';

-- Best-effort backfill from remaining conversation history (deleted rows are gone).
update profiles p
set gus_messages_used = greatest(
  p.gus_messages_used,
  coalesce((
    select count(*)::integer
    from conversations c
    where c.user_id = p.id
      and c.role = 'user'
  ), 0)
);

-- Atomically consume one free (or pro) message slot.
-- For free users: increments only when gus_messages_used < p_limit.
-- For subscribers: always increments and allows.
-- Returns { allowed: boolean, messages_used: int, is_subscribed: boolean }.
create or replace function try_consume_gus_message(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  subscribed boolean;
  used integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit';
  end if;

  select is_subscribed, gus_messages_used
    into subscribed, used
  from profiles
  where id = uid
  for update;

  if not found then
    insert into profiles (id) values (uid)
    on conflict (id) do nothing;

    select is_subscribed, gus_messages_used
      into subscribed, used
    from profiles
    where id = uid
    for update;
  end if;

  if coalesce(subscribed, false) then
    update profiles
    set gus_messages_used = gus_messages_used + 1
    where id = uid
    returning gus_messages_used into used;

    return jsonb_build_object(
      'allowed', true,
      'messages_used', used,
      'is_subscribed', true
    );
  end if;

  update profiles
  set gus_messages_used = gus_messages_used + 1
  where id = uid
    and gus_messages_used < p_limit
  returning gus_messages_used into used;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'messages_used', used,
      'is_subscribed', false
    );
  end if;

  select gus_messages_used into used from profiles where id = uid;

  return jsonb_build_object(
    'allowed', false,
    'messages_used', coalesce(used, p_limit),
    'is_subscribed', false
  );
end;
$$;

revoke all on function try_consume_gus_message(integer) from public;
grant execute on function try_consume_gus_message(integer) to authenticated;
grant execute on function try_consume_gus_message(integer) to anon;
