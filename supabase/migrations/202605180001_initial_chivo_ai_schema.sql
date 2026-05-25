create extension if not exists "pgcrypto";

do $$ begin
  create type public.school_role as enum ('owner', 'admin', 'teacher', 'student', 'guardian');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.membership_status as enum ('active', 'invited', 'review', 'declined', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lesson_status as enum ('draft', 'recording', 'uploaded', 'transcribing', 'review', 'published', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.processing_status as enum ('queued', 'running', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.learning_mode as enum ('simple', 'balanced', 'exam', 'story', 'catch_up');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lesson_output_type as enum ('master', 'summary', 'quiz', 'flashcards', 'audio_script', 'translation');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.crew_scope as enum ('school', 'cross_school');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.crew_member_role as enum ('owner', 'moderator', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_chain as enum ('solana', 'base', 'bnb');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'confirmed', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  sticker_key text,
  preferred_language text not null default 'English',
  learning_level text not null default 'balanced',
  audio_enabled boolean not null default true,
  locale text not null default 'en',
  timezone text not null default 'Africa/Lagos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text,
  city text,
  logo_url text,
  banner_url text,
  sticker_key text,
  subscription_status text not null default 'trial',
  external_crews_allowed boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.school_role not null,
  status public.membership_status not null default 'review',
  invited_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, profile_id)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  starts_at date not null,
  ends_at date not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  starts_at date not null,
  ends_at date not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  unique (academic_year_id, name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  department text,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_term_id uuid references public.academic_terms(id) on delete set null,
  name text not null,
  username text not null,
  grade_level text,
  logo_url text,
  banner_url text,
  sticker_key text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, username),
  unique (school_id, name, academic_term_id)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_membership_id uuid references public.school_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

create table public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  school_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  role public.school_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (class_id, school_membership_id)
);

create table public.school_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  code text not null unique,
  role public.school_role not null,
  status text not null default 'active',
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.school_join_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_role public.school_role not null default 'student',
  status public.membership_status not null default 'review',
  message text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_membership_id uuid references public.school_memberships(id) on delete set null,
  title text not null,
  status public.lesson_status not null default 'draft',
  language text not null default 'English',
  duration_seconds integer,
  recorded_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_recordings (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create table public.lesson_transcripts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  provider text not null default 'gemini',
  language text not null default 'English',
  raw_text text,
  cleaned_text text,
  confidence numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (lesson_id, provider, language)
);

create table public.ai_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  provider text not null default 'gemini',
  job_type text not null,
  status public.processing_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lesson_outputs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  output_type public.lesson_output_type not null,
  language text not null default 'English',
  learning_level text,
  title text,
  summary text,
  key_points jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (lesson_id, output_type, language, learning_level)
);

create table public.lesson_personalizations (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  output_id uuid references public.lesson_outputs(id) on delete set null,
  language text not null,
  learning_mode public.learning_mode not null default 'balanced',
  summary text not null,
  content jsonb not null default '{}'::jsonb,
  audio_path text,
  created_at timestamptz not null default now(),
  unique (lesson_id, student_membership_id, language, learning_mode)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  learning_mode public.learning_mode not null default 'balanced',
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer text,
  explanation text,
  created_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  score numeric(5, 2),
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  language text not null default 'English',
  learning_level text,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);

create table public.student_topic_progress (
  id uuid primary key default gen_random_uuid(),
  student_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic text not null,
  mastery_score numeric(5, 2) not null default 0,
  confidence_score numeric(5, 2) not null default 0,
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_membership_id, subject_id, topic)
);

create table public.student_weak_areas (
  id uuid primary key default gen_random_uuid(),
  student_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  topic text not null,
  reason text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  student_membership_id uuid not null references public.school_memberships(id) on delete cascade,
  status public.membership_status not null default 'review',
  created_at timestamptz not null default now(),
  unique (guardian_membership_id, student_membership_id)
);

create table public.lesson_crews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  username text not null,
  logo_url text,
  banner_url text,
  sticker_key text,
  scope public.crew_scope not null default 'school',
  invite_code text not null unique,
  external_sharing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crew_invites (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.lesson_crews(id) on delete cascade,
  code text not null unique,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.crew_memberships (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.lesson_crews(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  school_membership_id uuid references public.school_memberships(id) on delete set null,
  role public.crew_member_role not null default 'member',
  status public.membership_status not null default 'review',
  created_at timestamptz not null default now(),
  unique (crew_id, profile_id)
);

create table public.crew_resources (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.lesson_crews(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  resource_type text not null default 'note',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.crew_messages (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.lesson_crews(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid references public.crew_resources(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan_name text not null,
  status text not null default 'trial',
  monthly_usd numeric(12, 2) not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id)
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  chain public.subscription_chain not null,
  wallet_address text not null,
  tx_hash text not null,
  amount_usd numeric(12, 2) not null,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (chain, tx_hash)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value, description)
values (
  'school_creation',
  '{"enabled": true, "message": null}'::jsonb,
  'Controls whether new schools can be created from the public app.'
),
(
  'company_branding',
  '{"name": "Chivo AI", "subtitle": "Learn smarter", "logoUrl": null}'::jsonb,
  'Controls company branding shown in shared app navigation.'
);

create index school_memberships_profile_id_idx on public.school_memberships(profile_id);
create index class_memberships_school_membership_id_idx on public.class_memberships(school_membership_id);
create index school_join_requests_school_profile_status_idx on public.school_join_requests(school_id, profile_id, status);
create index lessons_school_class_idx on public.lessons(school_id, class_id);
create index lesson_personalizations_student_idx on public.lesson_personalizations(student_membership_id);
create index crew_memberships_profile_id_idx on public.crew_memberships(profile_id);
create unique index lesson_crews_username_idx on public.lesson_crews(username);
create index notifications_profile_read_idx on public.notifications(profile_id, read_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

create trigger school_memberships_set_updated_at
before update on public.school_memberships
for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create trigger lesson_crews_set_updated_at
before update on public.lesson_crews
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    preferred_language,
    learning_level,
    audio_enabled
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'New user'),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'English'),
    coalesce(new.raw_user_meta_data ->> 'learning_level', 'balanced'),
    coalesce((new.raw_user_meta_data ->> 'audio_enabled')::boolean, true)
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    preferred_language = excluded.preferred_language,
    learning_level = excluded.learning_level,
    audio_enabled = excluded.audio_enabled;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = target_school_id
      and sm.profile_id = auth.uid()
      and sm.status = 'active'
  );
$$;

create or replace function public.has_school_role(target_school_id uuid, allowed_roles public.school_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = target_school_id
      and sm.profile_id = auth.uid()
      and sm.status = 'active'
      and sm.role = any(allowed_roles)
  );
$$;

create or replace function public.is_class_member(target_class_id uuid)
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
      and sm.status = 'active'
      and sm.profile_id = auth.uid()
  );
$$;

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

create or replace function public.is_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_memberships cm
    where cm.crew_id = target_crew_id
      and cm.profile_id = auth.uid()
      and cm.status = 'active'
  );
$$;

create or replace function public.chivo_username(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), '');
$$;

create or replace function public.create_class_for_school(
  school_id_input uuid,
  class_name text,
  academic_term_id_input uuid default null,
  class_username_input text default null,
  grade_level_input text default null,
  logo_url_input text default null,
  banner_url_input text default null,
  sticker_key_input text default null
)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  membership_record record;
  clean_username text;
  new_class public.classes;
begin
  if viewer_id is null then
    raise exception 'You must be signed in to create a class.';
  end if;

  if nullif(btrim(class_name), '') is null then
    raise exception 'Class name is required.';
  end if;

  select sm.id, sm.role
  into membership_record
  from public.school_memberships sm
  where sm.school_id = school_id_input
    and sm.profile_id = viewer_id
    and sm.status = 'active'
    and sm.role = any(array['owner', 'admin', 'teacher']::public.school_role[])
  limit 1;

  if not found then
    raise exception 'You need teacher access before creating a class.';
  end if;

  if academic_term_id_input is not null and not exists (
    select 1
    from public.academic_terms at
    where at.id = academic_term_id_input
      and at.school_id = school_id_input
  ) then
    raise exception 'That academic term does not belong to this school.';
  end if;

  clean_username := coalesce(public.chivo_username(class_username_input), public.chivo_username(class_name), 'class');

  insert into public.classes (
    school_id,
    academic_term_id,
    name,
    username,
    grade_level,
    logo_url,
    banner_url,
    sticker_key,
    created_by
  )
  values (
    school_id_input,
    academic_term_id_input,
    btrim(class_name),
    clean_username,
    nullif(btrim(coalesce(grade_level_input, '')), ''),
    nullif(btrim(coalesce(logo_url_input, '')), ''),
    nullif(btrim(coalesce(banner_url_input, '')), ''),
    nullif(btrim(coalesce(sticker_key_input, '')), ''),
    viewer_id
  )
  returning * into new_class;

  insert into public.class_memberships (
    class_id,
    school_membership_id,
    role,
    status
  )
  values (
    new_class.id,
    membership_record.id,
    membership_record.role,
    'active'
  )
  on conflict (class_id, school_membership_id) do update
  set
    role = excluded.role,
    status = 'active';

  return new_class;
exception when unique_violation then
  raise exception 'A class in this school already uses that name or username.';
end;
$$;

create or replace function public.create_crew_with_owner(
  crew_name text,
  school_membership uuid default null,
  crew_scope public.crew_scope default 'school'
)
returns public.lesson_crews
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  membership_record record;
  new_crew public.lesson_crews;
  next_code text;
  base_username text;
  next_username text;
  attempt integer := 0;
begin
  if viewer_id is null then
    raise exception 'You must be signed in to create a crew.';
  end if;

  if nullif(btrim(crew_name), '') is null then
    raise exception 'Crew name is required.';
  end if;

  if school_membership is null then
    raise exception 'Choose a school before creating a crew.';
  end if;

  select sm.id, sm.school_id, sm.role, s.external_crews_allowed
  into membership_record
  from public.school_memberships sm
  join public.schools s on s.id = sm.school_id
  where sm.id = school_membership
    and sm.profile_id = viewer_id
    and sm.status = 'active';

  if not found then
    raise exception 'You need active school access before creating a crew.';
  end if;

  if crew_scope = 'cross_school' and coalesce(membership_record.external_crews_allowed, false) is false then
    raise exception 'Cross-school crews are not enabled for this school.';
  end if;

  base_username := coalesce(public.chivo_username(crew_name), 'crew');

  loop
    next_code := 'CRW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    next_username := case
      when attempt = 0 then base_username
      else base_username || '-' || (attempt + 1)
    end;

    begin
      insert into public.lesson_crews (
        school_id,
        owner_profile_id,
        name,
        username,
        scope,
        invite_code,
        external_sharing_enabled
      )
      values (
        membership_record.school_id,
        viewer_id,
        btrim(crew_name),
        next_username,
        crew_scope,
        next_code,
        crew_scope = 'cross_school'
      )
      returning * into new_crew;

      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 50 then
        raise exception 'Could not generate a unique crew username. Try another name.';
      end if;
    end;
  end loop;

  insert into public.crew_memberships (
    crew_id,
    profile_id,
    school_membership_id,
    role,
    status
  )
  values (
    new_crew.id,
    viewer_id,
    membership_record.id,
    'owner',
    'active'
  )
  on conflict (crew_id, profile_id) do update
  set
    school_membership_id = excluded.school_membership_id,
    role = 'owner',
    status = 'active';

  return new_crew;
end;
$$;

create or replace function public.join_crew_by_code(
  invite_code_input text,
  school_membership uuid default null
)
returns public.lesson_crews
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_crew public.lesson_crews;
  membership_record record;
  selected_school_membership_id uuid;
begin
  if viewer_id is null then
    raise exception 'You must be signed in to join a crew.';
  end if;

  select *
  into target_crew
  from public.lesson_crews
  where lower(invite_code) = lower(btrim(invite_code_input))
  limit 1;

  if not found then
    raise exception 'Crew code was not found.';
  end if;

  if target_crew.school_id is not null then
    if school_membership is not null then
      select sm.id, sm.school_id
      into membership_record
      from public.school_memberships sm
      where sm.id = school_membership
        and sm.profile_id = viewer_id
        and sm.school_id = target_crew.school_id
        and sm.status = 'active';

      if not found then
        raise exception 'Join the school before joining this crew.';
      end if;

      selected_school_membership_id := membership_record.id;
    else
      select sm.id, sm.school_id
      into membership_record
      from public.school_memberships sm
      where sm.profile_id = viewer_id
        and sm.school_id = target_crew.school_id
        and sm.status = 'active'
      order by sm.created_at desc
      limit 1;

      if not found then
        raise exception 'Join the school before joining this crew.';
      end if;

      selected_school_membership_id := membership_record.id;
    end if;
  end if;

  if target_crew.scope = 'cross_school' and target_crew.external_sharing_enabled is false then
    raise exception 'This crew is not open for external joining.';
  end if;

  insert into public.crew_memberships (
    crew_id,
    profile_id,
    school_membership_id,
    role,
    status
  )
  values (
    target_crew.id,
    viewer_id,
    selected_school_membership_id,
    'member',
    'active'
  )
  on conflict (crew_id, profile_id) do update
  set
    school_membership_id = coalesce(excluded.school_membership_id, public.crew_memberships.school_membership_id),
    status = 'active';

  return target_crew;
end;
$$;

revoke execute on function public.create_crew_with_owner(text, uuid, public.crew_scope) from public;
revoke execute on function public.join_crew_by_code(text, uuid) from public;
revoke execute on function public.create_class_for_school(uuid, text, uuid, text, text, text, text, text) from public;

grant execute on function public.create_crew_with_owner(text, uuid, public.crew_scope) to authenticated;
grant execute on function public.join_crew_by_code(text, uuid) to authenticated;
grant execute on function public.create_class_for_school(uuid, text, uuid, text, text, text, text, text) to authenticated;

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

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.academic_years enable row level security;
alter table public.academic_terms enable row level security;
alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.class_subjects enable row level security;
alter table public.class_memberships enable row level security;
alter table public.school_invites enable row level security;
alter table public.school_join_requests enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_recordings enable row level security;
alter table public.lesson_transcripts enable row level security;
alter table public.ai_processing_jobs enable row level security;
alter table public.lesson_outputs enable row level security;
alter table public.lesson_personalizations enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.flashcards enable row level security;
alter table public.student_topic_progress enable row level security;
alter table public.student_weak_areas enable row level security;
alter table public.guardian_links enable row level security;
alter table public.lesson_crews enable row level security;
alter table public.crew_invites enable row level security;
alter table public.crew_memberships enable row level security;
alter table public.crew_resources enable row level security;
alter table public.crew_messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

create policy "authenticated users read platform settings"
on public.platform_settings for select
using (auth.role() = 'authenticated');

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

create policy "profiles can update self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles can insert self"
on public.profiles for insert
with check (id = auth.uid());

create policy "school members can read schools"
on public.schools for select
using (public.is_school_member(id));

create policy "authenticated users can create schools"
on public.schools for insert
with check (created_by = auth.uid());

create policy "school admins can update schools"
on public.schools for update
using (public.has_school_role(id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(id, array['owner', 'admin']::public.school_role[]));

create policy "school members can read memberships"
on public.school_memberships for select
using (public.is_school_member(school_id) or profile_id = auth.uid());

create policy "school admins manage memberships"
on public.school_memberships for all
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "school members read academic years"
on public.academic_years for select
using (public.is_school_member(school_id));

create policy "school admins manage academic years"
on public.academic_years for all
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "school members read academic terms"
on public.academic_terms for select
using (public.is_school_member(school_id));

create policy "school admins manage academic terms"
on public.academic_terms for all
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "school members read subjects"
on public.subjects for select
using (public.is_school_member(school_id));

create policy "school admins manage subjects"
on public.subjects for all
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "school members read classes"
on public.classes for select
using (public.is_school_member(school_id));

create policy "school admins manage classes"
on public.classes for all
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "school members read class subjects"
on public.class_subjects for select
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_subjects.class_id
      and public.is_school_member(c.school_id)
  )
);

create policy "school admins manage class subjects"
on public.class_subjects for all
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_subjects.class_id
      and public.has_school_role(c.school_id, array['owner', 'admin']::public.school_role[])
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = class_subjects.class_id
      and public.has_school_role(c.school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "school members read class memberships"
on public.class_memberships for select
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_memberships.class_id
      and public.is_school_member(c.school_id)
  )
);

create policy "school admins manage class memberships"
on public.class_memberships for all
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_memberships.class_id
      and public.has_school_role(c.school_id, array['owner', 'admin']::public.school_role[])
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = class_memberships.class_id
      and public.has_school_role(c.school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "class teachers manage class memberships"
on public.class_memberships for all
using (public.can_manage_class_members(class_id))
with check (public.can_manage_class_members(class_id));

create policy "school admins manage invites"
on public.school_invites for all
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "users read own join requests"
on public.school_join_requests for select
using (profile_id = auth.uid() or public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "users create own join requests"
on public.school_join_requests for insert
with check (profile_id = auth.uid());

create policy "school admins update join requests"
on public.school_join_requests for update
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "class members and staff read lessons"
on public.lessons for select
using (
  public.is_class_member(class_id)
  or public.has_school_role(school_id, array['owner', 'admin', 'teacher']::public.school_role[])
);

create policy "teachers create lessons"
on public.lessons for insert
with check (
  public.has_school_role(school_id, array['owner', 'admin', 'teacher']::public.school_role[])
);

create policy "teachers update lessons"
on public.lessons for update
using (public.has_school_role(school_id, array['owner', 'admin', 'teacher']::public.school_role[]))
with check (public.has_school_role(school_id, array['owner', 'admin', 'teacher']::public.school_role[]));

create policy "school lesson readers read recordings"
on public.lesson_recordings for select
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_recordings.lesson_id
      and (
        public.is_class_member(l.class_id)
        or public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
      )
  )
);

create policy "teachers add recordings"
on public.lesson_recordings for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.lessons l
    where l.id = lesson_recordings.lesson_id
      and public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
);

create policy "school lesson readers read outputs"
on public.lesson_transcripts for select
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_transcripts.lesson_id
      and public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
);

create policy "teachers add lesson transcripts"
on public.lesson_transcripts for insert
with check (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_transcripts.lesson_id
      and public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
);

create policy "school staff read ai jobs"
on public.ai_processing_jobs for select
using (public.has_school_role(school_id, array['owner', 'admin', 'teacher']::public.school_role[]));

create policy "class members read lesson outputs"
on public.lesson_outputs for select
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_outputs.lesson_id
      and (
        public.is_class_member(l.class_id)
        or public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
      )
  )
);

create policy "students read own personalizations"
on public.lesson_personalizations for select
using (
  exists (
    select 1
    from public.school_memberships sm
    where sm.id = lesson_personalizations.student_membership_id
      and sm.profile_id = auth.uid()
      and sm.status = 'active'
  )
);

create policy "school staff read personalizations"
on public.lesson_personalizations for select
using (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_personalizations.lesson_id
      and public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
);

create policy "lesson readers read quizzes"
on public.quizzes for select
using (
  exists (
    select 1 from public.lessons l
    where l.id = quizzes.lesson_id
      and (public.is_class_member(l.class_id) or public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[]))
  )
);

create policy "lesson readers read quiz questions"
on public.quiz_questions for select
using (
  exists (
    select 1
    from public.quizzes q
    join public.lessons l on l.id = q.lesson_id
    where q.id = quiz_questions.quiz_id
      and (public.is_class_member(l.class_id) or public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[]))
  )
);

create policy "students manage own quiz attempts"
on public.quiz_attempts for all
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.id = quiz_attempts.student_membership_id
      and sm.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.school_memberships sm
    where sm.id = quiz_attempts.student_membership_id
      and sm.profile_id = auth.uid()
  )
);

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

create policy "lesson readers read flashcards"
on public.flashcards for select
using (
  exists (
    select 1 from public.lessons l
    where l.id = flashcards.lesson_id
      and (public.is_class_member(l.class_id) or public.has_school_role(l.school_id, array['owner', 'admin', 'teacher']::public.school_role[]))
  )
);

create policy "students read own progress"
on public.student_topic_progress for select
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.id = student_topic_progress.student_membership_id
      and sm.profile_id = auth.uid()
  )
);

create policy "staff read school progress"
on public.student_topic_progress for select
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.id = student_topic_progress.student_membership_id
      and public.has_school_role(sm.school_id, array['owner', 'admin', 'teacher']::public.school_role[])
  )
);

create policy "students and staff read weak areas"
on public.student_weak_areas for select
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.id = student_weak_areas.student_membership_id
      and (sm.profile_id = auth.uid() or public.has_school_role(sm.school_id, array['owner', 'admin', 'teacher']::public.school_role[]))
  )
);

create policy "guardians read own links"
on public.guardian_links for select
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.id in (guardian_links.guardian_membership_id, guardian_links.student_membership_id)
      and sm.profile_id = auth.uid()
  )
);

create policy "crew members read crews"
on public.lesson_crews for select
using (public.is_crew_member(id));

create policy "users create crews"
on public.lesson_crews for insert
with check (owner_profile_id = auth.uid());

create policy "crew owners update crews"
on public.lesson_crews for update
using (
  exists (
    select 1 from public.crew_memberships cm
    where cm.crew_id = lesson_crews.id
      and cm.profile_id = auth.uid()
      and cm.status = 'active'
      and cm.role in ('owner', 'moderator')
  )
);

create policy "crew members read invites"
on public.crew_invites for select
using (public.is_crew_member(crew_id));

create policy "crew moderators manage invites"
on public.crew_invites for all
using (
  exists (
    select 1 from public.crew_memberships cm
    where cm.crew_id = crew_invites.crew_id
      and cm.profile_id = auth.uid()
      and cm.status = 'active'
      and cm.role in ('owner', 'moderator')
  )
)
with check (
  exists (
    select 1 from public.crew_memberships cm
    where cm.crew_id = crew_invites.crew_id
      and cm.profile_id = auth.uid()
      and cm.status = 'active'
      and cm.role in ('owner', 'moderator')
  )
);

create policy "users read own crew memberships"
on public.crew_memberships for select
using (profile_id = auth.uid() or public.is_crew_member(crew_id));

create policy "users request crew membership"
on public.crew_memberships for insert
with check (profile_id = auth.uid() and status in ('review', 'invited'));

create policy "crew members read resources"
on public.crew_resources for select
using (public.is_crew_member(crew_id));

create policy "crew members add resources"
on public.crew_resources for insert
with check (created_by = auth.uid() and public.is_crew_member(crew_id));

create policy "crew members read messages"
on public.crew_messages for select
using (public.is_crew_member(crew_id));

create policy "crew members send messages"
on public.crew_messages for insert
with check (sender_profile_id = auth.uid() and public.is_crew_member(crew_id));

create policy "school admins read subscriptions"
on public.subscriptions for select
using (public.has_school_role(school_id, array['owner', 'admin']::public.school_role[]));

create policy "school admins read payment transactions"
on public.payment_transactions for select
using (
  exists (
    select 1 from public.subscriptions s
    where s.id = payment_transactions.subscription_id
      and public.has_school_role(s.school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "users read own notifications"
on public.notifications for select
using (profile_id = auth.uid());

create policy "users update own notifications"
on public.notifications for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "school admins read audit logs"
on public.audit_logs for select
using (
  school_id is not null
  and public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
);
