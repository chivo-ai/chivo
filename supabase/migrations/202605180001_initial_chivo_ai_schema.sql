create extension if not exists "pgcrypto";

create type public.user_role as enum ('student', 'teacher', 'school_admin');
create type public.lesson_status as enum ('draft', 'recording', 'processing', 'ready', 'failed');
create type public.subscription_chain as enum ('solana', 'base', 'bnb');
create type public.crew_scope as enum ('school', 'cross_school');
create type public.crew_member_role as enum ('owner', 'moderator', 'member');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  subscription_status text not null default 'trial',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  role public.user_role not null default 'student',
  full_name text not null,
  preferred_language text not null default 'English',
  learning_level text not null default 'balanced',
  audio_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  subject text,
  grade_level text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (class_id, profile_id)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  title text not null,
  subject text,
  status public.lesson_status not null default 'draft',
  audio_path text,
  transcript text,
  master_summary text,
  language text not null default 'English',
  duration_seconds integer,
  recorded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lesson_personalizations (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  language text not null,
  learning_level text not null,
  summary text not null,
  quiz jsonb not null default '[]'::jsonb,
  flashcards jsonb not null default '[]'::jsonb,
  audio_path text,
  created_at timestamptz not null default now(),
  unique (lesson_id, student_id, language, learning_level)
);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  chain public.subscription_chain not null,
  wallet_address text not null,
  tx_hash text not null,
  amount_usd numeric(12, 2) not null,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (chain, tx_hash)
);

create table public.lesson_crews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  scope public.crew_scope not null default 'school',
  invite_code text not null unique,
  external_sharing_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.crew_memberships (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.lesson_crews(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.crew_member_role not null default 'member',
  status text not null default 'review',
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

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_personalizations enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.lesson_crews enable row level security;
alter table public.crew_memberships enable row level security;
alter table public.crew_resources enable row level security;

create policy "profiles can read their school profiles"
on public.profiles for select
using (
  id = auth.uid()
  or school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "school members can read school classes"
on public.classes for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "class members can read lessons"
on public.lessons for select
using (
  class_id in (
    select class_id from public.class_memberships where profile_id = auth.uid()
  )
);

create policy "teachers can create lessons"
on public.lessons for insert
with check (
  teacher_id = auth.uid()
  and class_id in (
    select class_id
    from public.class_memberships
    where profile_id = auth.uid()
    and role in ('teacher', 'school_admin')
  )
);

create policy "students can read their personalizations"
on public.lesson_personalizations for select
using (student_id = auth.uid());

create policy "school admins can read subscription payments"
on public.subscription_payments for select
using (
  school_id in (
    select school_id
    from public.profiles
    where id = auth.uid()
    and role = 'school_admin'
  )
);

create policy "crew members can read their crews"
on public.lesson_crews for select
using (
  id in (
    select crew_id
    from public.crew_memberships
    where profile_id = auth.uid()
    and status = 'active'
  )
);

create policy "school members can create school crews"
on public.lesson_crews for insert
with check (
  owner_id = auth.uid()
  and (
    scope = 'cross_school'
    or school_id in (
      select school_id
      from public.profiles
      where id = auth.uid()
    )
  )
);

create policy "users can read their crew memberships"
on public.crew_memberships for select
using (profile_id = auth.uid());

create policy "users can request crew membership"
on public.crew_memberships for insert
with check (
  profile_id = auth.uid()
  and status in ('review', 'invited')
);

create policy "crew members can read resources"
on public.crew_resources for select
using (
  crew_id in (
    select crew_id
    from public.crew_memberships
    where profile_id = auth.uid()
    and status = 'active'
  )
);

create policy "crew members can add resources"
on public.crew_resources for insert
with check (
  created_by = auth.uid()
  and crew_id in (
    select crew_id
    from public.crew_memberships
    where profile_id = auth.uid()
    and status = 'active'
  )
);
