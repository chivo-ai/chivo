-- Chivo AI Group 4 upgrade for quiz progress and teacher insight.
-- Run this before testing teacher quiz attempt insight on an existing database.

drop policy if exists "staff read school quiz attempts" on public.quiz_attempts;

create policy "staff read school quiz attempts"
on public.quiz_attempts for select
using (
  exists (
    select 1
    from public.quizzes q
    join public.lessons l on l.id = q.lesson_id
    where q.id = quiz_attempts.quiz_id
      and public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
);
