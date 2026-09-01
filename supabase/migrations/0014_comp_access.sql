-- Complimentary access: grant tier without Stripe (owner, demos, support).
-- comp_expires_at NULL = never expires. Stripe webhooks do not clear comp fields.

alter table profiles
  add column if not exists comp_tier text
    check (comp_tier is null or comp_tier in ('basic', 'pro', 'premium')),
  add column if not exists comp_expires_at timestamptz;

comment on column profiles.comp_tier is
  'Optional complimentary tier (basic | pro | premium), independent of Stripe.';
comment on column profiles.comp_expires_at is
  'When comp access ends; NULL = permanent.';

create or replace function tier_rank(tier text)
returns integer
language sql
immutable
as $$
  select case tier
    when 'premium' then 3
    when 'pro' then 2
    when 'basic' then 1
    else 0
  end;
$$;

create or replace function effective_subscription_tier(
  p_subscription_tier text,
  p_comp_tier text,
  p_comp_expires_at timestamptz
)
returns text
language sql
stable
as $$
  with ranks as (
    select
      tier_rank(coalesce(p_subscription_tier, 'free')) as sub_rank,
      case
        when p_comp_tier is not null
          and p_comp_tier in ('basic', 'pro', 'premium')
          and (p_comp_expires_at is null or p_comp_expires_at > now())
        then tier_rank(p_comp_tier)
        else 0
      end as comp_rank
  )
  select case greatest(sub_rank, comp_rank)
    when 3 then 'premium'
    when 2 then 'pro'
    when 1 then 'basic'
    else 'free'
  end
  from ranks;
$$;

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
  sub_tier text;
  comp_t text;
  comp_exp timestamptz;
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

  select subscription_tier, comp_tier, comp_expires_at, gus_messages_used, gus_messages_period_start
    into sub_tier, comp_t, comp_exp, used, period_start
  from profiles
  where id = uid
  for update;

  if not found then
    insert into profiles (id) values (uid)
    on conflict (id) do nothing;

    select subscription_tier, comp_tier, comp_expires_at, gus_messages_used, gus_messages_period_start
      into sub_tier, comp_t, comp_exp, used, period_start
    from profiles
    where id = uid
    for update;
  end if;

  tier := effective_subscription_tier(sub_tier, comp_t, comp_exp);
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
