-- Chivo AI Group 11 upgrade for classroom study tools.
-- Run this on an existing database before testing class chat, class voice notes, shared class AI, and live class study.

create or replace function public.is_class_participant(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_memberships cm
    join public.school_memberships sm on sm.id = cm.school_membership_id
    where cm.class_id = target_class_id
      and cm.status = 'active'
      and sm.profile_id = auth.uid()
      and sm.status = 'active'
  )
  or exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and public.has_school_role(c.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
  or exists (
    select 1
    from public.class_subjects cs
    join public.school_memberships sm on sm.id = cs.teacher_membership_id
    where cs.class_id = target_class_id
      and sm.profile_id = auth.uid()
      and sm.status = 'active'
      and sm.role = any(array['owner', 'admin', 'teacher']::public.school_role[])
  );
$$;

create table if not exists public.class_resources (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  resource_type text not null default 'note',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.class_messages (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid references public.class_resources(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.class_resources enable row level security;
alter table public.class_messages enable row level security;

drop policy if exists "class participants read resources" on public.class_resources;
drop policy if exists "class participants add resources" on public.class_resources;
drop policy if exists "class participants update own resources" on public.class_resources;
drop policy if exists "class participants read messages" on public.class_messages;
drop policy if exists "class participants send messages" on public.class_messages;

create policy "class participants read resources"
on public.class_resources for select
using (public.is_class_participant(class_id));

create policy "class participants add resources"
on public.class_resources for insert
with check (created_by = auth.uid() and public.is_class_participant(class_id));

create policy "class participants update own resources"
on public.class_resources for update
using (created_by = auth.uid() and public.is_class_participant(class_id))
with check (created_by = auth.uid() and public.is_class_participant(class_id));

create policy "class participants read messages"
on public.class_messages for select
using (public.is_class_participant(class_id));

create policy "class participants send messages"
on public.class_messages for insert
with check (sender_profile_id = auth.uid() and public.is_class_participant(class_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chivo-class-audio',
  'chivo-class-audio',
  false,
  104857600,
  array[
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/mp3',
    'audio/mpeg',
    'audio/aiff',
    'audio/ogg',
    'audio/flac',
    'audio/webm',
    'audio/wav',
    'audio/3gpp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "class participants read class audio" on storage.objects;
drop policy if exists "class participants upload own class audio" on storage.objects;
drop policy if exists "class participants update own class audio" on storage.objects;
drop policy if exists "class participants delete own class audio" on storage.objects;

create policy "class participants read class audio"
on storage.objects for select
using (
  bucket_id = 'chivo-class-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_class_participant(((storage.foldername(name))[1])::uuid)
);

create policy "class participants upload own class audio"
on storage.objects for insert
with check (
  bucket_id = 'chivo-class-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_class_participant(((storage.foldername(name))[1])::uuid)
);

create policy "class participants update own class audio"
on storage.objects for update
using (
  bucket_id = 'chivo-class-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_class_participant(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'chivo-class-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_class_participant(((storage.foldername(name))[1])::uuid)
);

create policy "class participants delete own class audio"
on storage.objects for delete
using (
  bucket_id = 'chivo-class-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_class_participant(((storage.foldername(name))[1])::uuid)
);
