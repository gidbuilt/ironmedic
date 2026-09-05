-- App Store (StoreKit) billing: link an Apple originalTransactionId to a profile
-- so server-verified purchases and App Store Server Notifications can unlock the
-- same subscription_tier Stripe uses.

alter table profiles
  add column if not exists apple_original_transaction_id text,
  add column if not exists billing_provider text
    check (billing_provider is null or billing_provider in ('stripe', 'apple'));

comment on column profiles.apple_original_transaction_id is
  'App Store originalTransactionId for the current Apple subscription, if any.';
comment on column profiles.billing_provider is
  'Who last granted subscription_tier: stripe | apple. Null if never billed.';

create unique index if not exists profiles_apple_original_transaction_id_uidx
  on profiles (apple_original_transaction_id)
  where apple_original_transaction_id is not null;
