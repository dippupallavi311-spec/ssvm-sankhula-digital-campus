-- Day 4: Public-site access hardening
-- Applied to the connected Supabase project on 2026-11-12.
-- Public visitors may read only published school-facing content and active class names.
-- Student, teacher, attendance, fee, exam, notification and settings tables remain private.

begin;

revoke all privileges on all tables in schema public from anon;

grant select on public.class_groups, public.gallery_items, public.achievements to anon;
grant insert on public.admission_enquiries to anon;

drop policy if exists "public read active classes" on public.class_groups;
create policy "public read active classes"
on public.class_groups
for select
to anon
using (active = true);

commit;
