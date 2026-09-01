-- Add Basic tier ($14/mo, monthly cap). Pro ($29) and Premium ($49) stay unlimited text.

alter table profiles drop constraint if exists profiles_subscription_tier_check;

alter table profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'basic', 'pro', 'premium'));

comment on column profiles.subscription_tier is
  'free | basic (monthly cap) | pro (unlimited text) | premium (unlimited + vision).';

drop function if exists public.try_consume_gus_message(integer);

create function try_consume_gus_message(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tier text;
  used integer;
  period_start date;
  paid boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'invalid basic monthly limit';
  end if;

  select subscription_tier, gus_messages_used, gus_messages_period_start
    into tier, used, period_start
  from profiles
  where id = uid
  for update;

  if not found then
    insert into profiles (id) values (uid)
    on conflict (id) do nothing;

    select subscription_tier, gus_messages_used, gus_messages_period_start
      into tier, used, period_start
    from profiles
    where id = uid
    for update;
  end if;

  tier := coalesce(tier, 'free');
  used := coalesce(used, 0);
  period_start := coalesce(period_start, date_trunc('month', current_date)::date);

  if date_trunc('month', period_start) < date_trunc('month', current_date) then
    used := 0;
    period_start := date_trunc('month', current_date)::date;
    update profiles
    set gus_messages_used = 0,
        gus_messages_period_start = period_start
    where id = uid;
  end if;

  paid := tier in ('basic', 'pro', 'premium');

  if not paid then
    return jsonb_build_object(
      'allowed', false,
      'messages_used', used,
      'messages_limit', null,
      'is_subscribed', false,
      'subscription_tier', tier,
      'reason', 'subscription_required'
    );
  end if;

  -- Pro & Premium: unlimited text diagnostics.
  if tier in ('pro', 'premium') then
    update profiles
    set gus_messages_used = gus_messages_used + 1,
        is_subscribed = true
    where id = uid
    returning gus_messages_used into used;

    return jsonb_build_object(
      'allowed', true,
      'messages_used', used,
      'messages_limit', null,
      'is_subscribed', true,
      'subscription_tier', tier
    );
  end if;

  -- Basic: monthly cap.
  if used >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'messages_used', used,
      'messages_limit', p_limit,
      'is_subscribed', true,
      'subscription_tier', tier,
      'reason', 'monthly_limit'
    );
  end if;

  update profiles
  set gus_messages_used = gus_messages_used + 1,
      is_subscribed = true
  where id = uid
  returning gus_messages_used into used;

  return jsonb_build_object(
    'allowed', true,
    'messages_used', used,
    'messages_limit', p_limit,
    'is_subscribed', true,
    'subscription_tier', tier
  );
end;
$$;

revoke all on function try_consume_gus_message(integer) from public;
grant execute on function try_consume_gus_message(integer) to authenticated;
grant execute on function try_consume_gus_message(integer) to anon;
