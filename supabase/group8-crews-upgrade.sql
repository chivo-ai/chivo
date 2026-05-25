-- Chivo AI Group 8 upgrade for quick class creation and real crews.
-- Run this on an existing database before testing school quick-create and the Crews screen.

create or replace function public.chivo_username(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), '');
$$;

alter table public.lesson_crews add column if not exists username text;

with ranked_crews as (
  select
    id,
    coalesce(public.chivo_username(name), 'crew') as base_username,
    row_number() over (
      partition by coalesce(public.chivo_username(name), 'crew')
      order by created_at, id
    ) as duplicate_number
  from public.lesson_crews
  where username is null or btrim(username) = ''
)
update public.lesson_crews lc
set username = case
  when ranked_crews.duplicate_number = 1 then ranked_crews.base_username
  else ranked_crews.base_username || '-' || ranked_crews.duplicate_number
end
from ranked_crews
where lc.id = ranked_crews.id;

alter table public.lesson_crews
alter column username set not null;

create unique index if not exists lesson_crews_username_idx
on public.lesson_crews(username);

do $$ begin
  alter table public.lesson_crews
  add constraint lesson_crews_username_format_check
  check (username = public.chivo_username(username))
  not valid;
exception when duplicate_object then null;
end $$;

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
