-- Chivo AI Group 7 upgrade for future company-side platform controls.
-- Run this on an existing database before testing global school creation controls.

create table if not exists public.platform_settings (
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
)
on conflict (key) do nothing;

insert into public.platform_settings (key, value, description)
values (
  'company_branding',
  '{"name": "Chivo AI", "subtitle": "Learn smarter", "logoUrl": null}'::jsonb,
  'Controls company branding shown in shared app navigation.'
)
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "authenticated users read platform settings" on public.platform_settings;

create policy "authenticated users read platform settings"
on public.platform_settings for select
using (auth.role() = 'authenticated');
