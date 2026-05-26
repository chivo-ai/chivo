-- Chivo AI Group 9 upgrade for activity notifications.
-- Run this on an existing database before testing notification badges and crew AI alerts.

alter table public.notifications
add column if not exists data jsonb not null default '{}'::jsonb;
