-- Monthly message limits for Basic (pro) tier; no free usage without subscription.

alter table profiles
  add column if not exists gus_messages_period_start date not null default (date_trunc('month', current_date)::date);

comment on column profiles.gus_messages_period_start is
  'Start of the calendar month for gus_messages_used (Basic tier monthly cap).';

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

  -- Reset counter at the start of each calendar month.
  if date_trunc('month', period_start) < date_trunc('month', current_date) then
    used := 0;
    period_start := date_trunc('month', current_date)::date;
    update profiles
    set gus_messages_used = 0,
        gus_messages_period_start = period_start
    where id = uid;
  end if;

  paid := tier in ('pro', 'premium');

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

  -- Premium: unlimited text diagnostics.
  if tier = 'premium' then
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

  -- Basic (pro): monthly cap.
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
