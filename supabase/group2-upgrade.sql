-- Chivo AI Group 2 upgrade for an existing early development database.
-- Run this before testing lesson transcript creation if your database already has the Group 1 schema.

drop policy if exists "teachers add lesson transcripts" on public.lesson_transcripts;

create policy "teachers add lesson transcripts"
on public.lesson_transcripts for insert
with check (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_transcripts.lesson_id
      and public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
);
