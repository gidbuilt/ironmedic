-- Pro + Premium subscription tiers (replaces boolean-only is_subscribed).

alter table profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro', 'premium'));

comment on column profiles.subscription_tier is
  'free | pro (unlimited text) | premium (text + photo/video vision).';

-- Existing Stripe subscribers become Pro until webhook upgrades them.
update profiles
set subscription_tier = 'pro'
where is_subscribed = true
  and subscription_tier = 'free';

create or replace function try_consume_gus_message(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tier text;
  used integer;
  paid boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit';
  end if;

  select subscription_tier, gus_messages_used
    into tier, used
  from profiles
  where id = uid
  for update;

  if not found then
    insert into profiles (id) values (uid)
    on conflict (id) do nothing;

    select subscription_tier, gus_messages_used
      into tier, used
    from profiles
    where id = uid
    for update;
  end if;

  tier := coalesce(tier, 'free');
  paid := tier in ('pro', 'premium');

  if paid then
    update profiles
    set gus_messages_used = gus_messages_used + 1,
        is_subscribed = true
    where id = uid
    returning gus_messages_used into used;

    return jsonb_build_object(
      'allowed', true,
      'messages_used', used,
      'is_subscribed', true,
      'subscription_tier', tier
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
      'is_subscribed', false,
      'subscription_tier', 'free'
    );
  end if;

  select gus_messages_used into used from profiles where id = uid;

  return jsonb_build_object(
    'allowed', false,
    'messages_used', coalesce(used, p_limit),
    'is_subscribed', false,
    'subscription_tier', 'free'
  );
end;
$$;

revoke all on function try_consume_gus_message(integer) from public;
grant execute on function try_consume_gus_message(integer) to authenticated;
grant execute on function try_consume_gus_message(integer) to anon;
