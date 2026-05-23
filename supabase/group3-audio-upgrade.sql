-- Chivo AI Group 3 upgrade for lesson audio capture.
-- Run this before testing native/mobile lesson recording.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chivo-lesson-audio',
  'chivo-lesson-audio',
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

drop policy if exists "lesson audio owners read" on storage.objects;
drop policy if exists "teachers upload lesson audio" on storage.objects;
drop policy if exists "lesson audio owners update" on storage.objects;
drop policy if exists "lesson audio owners delete" on storage.objects;

create policy "lesson audio owners read"
on storage.objects for select
using (
  bucket_id = 'chivo-lesson-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "teachers upload lesson audio"
on storage.objects for insert
with check (
  bucket_id = 'chivo-lesson-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "lesson audio owners update"
on storage.objects for update
using (
  bucket_id = 'chivo-lesson-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'chivo-lesson-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "lesson audio owners delete"
on storage.objects for delete
using (
  bucket_id = 'chivo-lesson-audio'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
