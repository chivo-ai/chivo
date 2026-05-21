-- Chivo AI development reset.
-- Use this only on an early development database when a migration was run partially
-- or manually through the SQL editor. This deletes Chivo AI public-schema data.
-- It does not delete Supabase auth.users.

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_school_member(uuid) cascade;
drop function if exists public.has_school_role(uuid, public.school_role[]) cascade;
drop function if exists public.is_class_member(uuid) cascade;
drop function if exists public.is_crew_member(uuid) cascade;

drop table if exists
  public.audit_logs,
  public.notifications,
  public.payment_transactions,
  public.subscription_payments,
  public.subscriptions,
  public.crew_messages,
  public.crew_resources,
  public.crew_memberships,
  public.crew_invites,
  public.lesson_crews,
  public.guardian_links,
  public.student_weak_areas,
  public.student_topic_progress,
  public.flashcards,
  public.quiz_attempts,
  public.quiz_questions,
  public.quizzes,
  public.lesson_personalizations,
  public.lesson_outputs,
  public.ai_processing_jobs,
  public.lesson_transcripts,
  public.lesson_recordings,
  public.lessons,
  public.school_join_requests,
  public.school_invites,
  public.class_memberships,
  public.class_subjects,
  public.classes,
  public.subjects,
  public.academic_terms,
  public.academic_years,
  public.school_memberships,
  public.schools,
  public.profiles
cascade;

drop type if exists public.payment_status cascade;
drop type if exists public.subscription_chain cascade;
drop type if exists public.crew_member_role cascade;
drop type if exists public.crew_scope cascade;
drop type if exists public.lesson_output_type cascade;
drop type if exists public.learning_mode cascade;
drop type if exists public.processing_status cascade;
drop type if exists public.lesson_status cascade;
drop type if exists public.membership_status cascade;
drop type if exists public.school_role cascade;
drop type if exists public.user_role cascade;
