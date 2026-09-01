-- Grant permanent Premium complimentary access.
-- Run in Supabase SQL editor after migration 0014_comp_access.sql.
-- Replace the email with your IronMedic login.

update profiles
set comp_tier = 'premium',
    comp_expires_at = null
where id = (
  select id from auth.users where email = 'gid.osborn@gmail.com'
);

-- Verify:
select u.email, p.subscription_tier, p.comp_tier, p.comp_expires_at
from profiles p
join auth.users u on u.id = p.id
where u.email = 'gid.osborn@gmail.com';
