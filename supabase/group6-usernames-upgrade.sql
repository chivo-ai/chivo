-- Chivo AI Group 6 upgrade for username-based school and class routes.
-- Run this on an existing database before using /school/my-school/[username] and /school/class/[username].

alter table public.classes add column if not exists username text;

create or replace function public.chivo_username(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), '');
$$;

with ranked_classes as (
  select
    id,
    school_id,
    coalesce(public.chivo_username(name), 'class') as base_username,
    row_number() over (
      partition by school_id, coalesce(public.chivo_username(name), 'class')
      order by created_at, id
    ) as duplicate_number
  from public.classes
  where username is null or btrim(username) = ''
)
update public.classes c
set username = case
  when ranked_classes.duplicate_number = 1 then ranked_classes.base_username
  else ranked_classes.base_username || '-' || ranked_classes.duplicate_number
end
from ranked_classes
where c.id = ranked_classes.id;

alter table public.classes
alter column username set not null;

create unique index if not exists classes_school_username_idx
on public.classes(school_id, username);

do $$ begin
  alter table public.schools
  add constraint schools_slug_format_check
  check (slug = public.chivo_username(slug))
  not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.classes
  add constraint classes_username_format_check
  check (username = public.chivo_username(username))
  not valid;
exception when duplicate_object then null;
end $$;
