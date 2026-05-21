-- Chivo AI Group 1 upgrade for an existing early development database.
-- Run this if the initial migration was already applied before the Group 1 people workflow.

alter type public.membership_status add value if not exists 'declined';

create index if not exists school_join_requests_school_profile_status_idx
on public.school_join_requests(school_id, profile_id, status);

drop policy if exists "profiles can read own and school profiles" on public.profiles;

create policy "profiles can read own and school profiles"
on public.profiles for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.school_memberships viewer
    join public.school_memberships target on target.school_id = viewer.school_id
    where viewer.profile_id = auth.uid()
      and target.profile_id = profiles.id
      and viewer.status = 'active'
      and target.status = 'active'
  )
  or exists (
    select 1
    from public.school_join_requests request
    where request.profile_id = profiles.id
      and public.has_school_role(request.school_id, array['owner', 'admin']::public.school_role[])
  )
);
