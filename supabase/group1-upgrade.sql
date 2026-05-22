-- Chivo AI Group 1 upgrade for an existing early development database.
-- Run this if the initial migration was already applied before the Group 1 people workflow.

alter type public.membership_status add value if not exists 'declined';

alter table public.profiles add column if not exists sticker_key text;

alter table public.schools add column if not exists logo_url text;
alter table public.schools add column if not exists banner_url text;
alter table public.schools add column if not exists sticker_key text;

alter table public.classes add column if not exists logo_url text;
alter table public.classes add column if not exists banner_url text;
alter table public.classes add column if not exists sticker_key text;

alter table public.lesson_crews add column if not exists logo_url text;
alter table public.lesson_crews add column if not exists banner_url text;
alter table public.lesson_crews add column if not exists sticker_key text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chivo-media',
  'chivo-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads chivo media" on storage.objects;
drop policy if exists "authenticated users upload chivo media" on storage.objects;
drop policy if exists "authenticated users update chivo media" on storage.objects;
drop policy if exists "authenticated users delete chivo media" on storage.objects;

create policy "public reads chivo media"
on storage.objects for select
using (bucket_id = 'chivo-media');

create policy "authenticated users upload chivo media"
on storage.objects for insert
with check (
  bucket_id = 'chivo-media'
  and auth.role() = 'authenticated'
  and (
    ((storage.foldername(name))[1] in ('profiles', 'drafts') and (storage.foldername(name))[2] = auth.uid()::text)
    or (storage.foldername(name))[1] in ('schools', 'classes', 'crews')
  )
);

create policy "authenticated users update chivo media"
on storage.objects for update
using (
  bucket_id = 'chivo-media'
  and auth.role() = 'authenticated'
  and (
    ((storage.foldername(name))[1] in ('profiles', 'drafts') and (storage.foldername(name))[2] = auth.uid()::text)
    or (storage.foldername(name))[1] in ('schools', 'classes', 'crews')
  )
)
with check (
  bucket_id = 'chivo-media'
  and auth.role() = 'authenticated'
  and (
    ((storage.foldername(name))[1] in ('profiles', 'drafts') and (storage.foldername(name))[2] = auth.uid()::text)
    or (storage.foldername(name))[1] in ('schools', 'classes', 'crews')
  )
);

create policy "authenticated users delete chivo media"
on storage.objects for delete
using (
  bucket_id = 'chivo-media'
  and auth.role() = 'authenticated'
  and (
    ((storage.foldername(name))[1] in ('profiles', 'drafts') and (storage.foldername(name))[2] = auth.uid()::text)
    or (storage.foldername(name))[1] in ('schools', 'classes', 'crews')
  )
);

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
