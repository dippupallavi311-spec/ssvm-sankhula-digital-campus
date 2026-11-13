-- Day 5: secure first Admin account activation template
-- An authorized adult school/project administrator must perform these steps.
-- 1) Create and verify the official Admin email account in Supabase Auth.
-- 2) Replace the placeholder below with that exact email address.
-- 3) Run this SQL once in the Supabase SQL Editor while signed in as the project owner.
-- Never put the Admin password, service-role key, or any API secret in this file or GitHub.

do $bootstrap$
declare
  target_email text := lower(trim('REPLACE_WITH_OFFICIAL_SCHOOL_ADMIN_EMAIL'));
  target_user_id uuid;
begin
  if target_email = '' or target_email like '%REPLACE_WITH_%' then
    raise exception 'Replace the placeholder with the verified official Admin email before running this script.';
  end if;

  select id
    into target_user_id
    from auth.users
   where lower(email) = target_email
   limit 1;

  if target_user_id is null then
    raise exception 'No Supabase Auth user exists for this email. Create and verify the account first.';
  end if;

  insert into public.user_profiles (auth_user_id, role, display_name, active)
  values (target_user_id, 'admin', 'School Administrator', true)
  on conflict (auth_user_id) do update
    set role = 'admin',
        display_name = coalesce(public.user_profiles.display_name, 'School Administrator'),
        active = true,
        updated_at = now();
end
$bootstrap$;

-- Verify: this should return exactly the authorized Admin profile.
select role, display_name, active
from public.user_profiles
where auth_user_id = (
  select id from auth.users
  where lower(email) = lower('REPLACE_WITH_OFFICIAL_SCHOOL_ADMIN_EMAIL')
  limit 1
);
