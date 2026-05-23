-- Chivo AI Group 5 upgrade for class requests and teacher class rosters.
-- Run this on an existing database before testing teacher roster management.

create or replace function public.can_manage_class_members(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and (
        public.has_school_role(c.school_id, array['owner', 'admin']::public.school_role[])
        or exists (
          select 1
          from public.class_subjects cs
          join public.school_memberships sm on sm.id = cs.teacher_membership_id
          where cs.class_id = c.id
            and sm.profile_id = auth.uid()
            and sm.status = 'active'
            and sm.role = any(array['owner', 'admin', 'teacher']::public.school_role[])
        )
        or exists (
          select 1
          from public.class_memberships cm
          join public.school_memberships sm on sm.id = cm.school_membership_id
          where cm.class_id = c.id
            and cm.status = 'active'
            and sm.profile_id = auth.uid()
            and sm.status = 'active'
            and cm.role = any(array['owner', 'admin', 'teacher']::public.school_role[])
        )
      )
  );
$$;

drop policy if exists "class teachers manage class memberships" on public.class_memberships;

create policy "class teachers manage class memberships"
on public.class_memberships for all
using (public.can_manage_class_members(class_id))
with check (public.can_manage_class_members(class_id));
