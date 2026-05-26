-- Chivo AI Group 10 upgrade for crew study tools.
-- Run this on an existing database before testing crew voice notes and live study sessions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chivo-crew-audio',
  'chivo-crew-audio',
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

drop policy if exists "crew members read crew audio" on storage.objects;
drop policy if exists "crew members upload own crew audio" on storage.objects;
drop policy if exists "crew members update own crew audio" on storage.objects;
drop policy if exists "crew members delete own crew audio" on storage.objects;

create policy "crew members read crew audio"
on storage.objects for select
using (
  bucket_id = 'chivo-crew-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);

create policy "crew members upload own crew audio"
on storage.objects for insert
with check (
  bucket_id = 'chivo-crew-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);

create policy "crew members update own crew audio"
on storage.objects for update
using (
  bucket_id = 'chivo-crew-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'chivo-crew-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);

create policy "crew members delete own crew audio"
on storage.objects for delete
using (
  bucket_id = 'chivo-crew-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "crew members update own resources" on public.crew_resources;

create policy "crew members update own resources"
on public.crew_resources for update
using (created_by = auth.uid() and public.is_crew_member(crew_id))
with check (created_by = auth.uid() and public.is_crew_member(crew_id));
