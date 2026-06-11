-- Chivo AI Group 16 upgrade for the knowledge social network shell.
-- This keeps social graph, public profiles, comments, and reactions off-chain.
-- Blockchain stays focused on payment, ownership, royalties, funding, and receipts.

alter table public.knowledge_assets
drop constraint if exists knowledge_assets_asset_type_check;

alter table public.knowledge_assets
add constraint knowledge_assets_asset_type_check check (
  asset_type in (
    'article',
    'story',
    'lesson',
    'research_paper',
    'study',
    'report',
    'publication',
    'membership_pass',
    'funding_certificate',
    'collection'
  )
);

create table if not exists public.public_profile_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  public_slug text unique,
  visibility text not null default 'public',
  headline text,
  bio text,
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  badges jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_profile_settings_visibility_check check (visibility in ('public', 'unlisted', 'private'))
);

create table if not exists public.social_follows (
  id uuid primary key default gen_random_uuid(),
  follower_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_entity_type text not null,
  target_entity_id uuid not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (follower_profile_id, target_entity_type, target_entity_id),
  constraint social_follows_target_type_check check (target_entity_type in ('profile', 'school', 'knowledge_asset')),
  constraint social_follows_status_check check (status in ('active', 'muted', 'blocked', 'removed'))
);

create table if not exists public.knowledge_reactions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, profile_id, reaction_type),
  constraint knowledge_reactions_type_check check (reaction_type in ('like', 'save', 'insightful', 'boost'))
);

create table if not exists public.knowledge_comments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.knowledge_comments(id) on delete cascade,
  body text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_comments_status_check check (status in ('active', 'hidden', 'removed', 'under_review'))
);

create index if not exists public_profile_settings_slug_idx
on public.public_profile_settings(public_slug, visibility);

create index if not exists social_follows_target_idx
on public.social_follows(target_entity_type, target_entity_id, status, created_at desc);

create index if not exists social_follows_follower_idx
on public.social_follows(follower_profile_id, status, created_at desc);

create index if not exists knowledge_reactions_asset_idx
on public.knowledge_reactions(asset_id, reaction_type, created_at desc);

create index if not exists knowledge_comments_asset_idx
on public.knowledge_comments(asset_id, status, created_at desc);

do $$ begin
  create trigger public_profile_settings_set_updated_at
  before update on public.public_profile_settings
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger social_follows_set_updated_at
  before update on public.social_follows
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger knowledge_reactions_set_updated_at
  before update on public.knowledge_reactions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger knowledge_comments_set_updated_at
  before update on public.knowledge_comments
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

alter table public.public_profile_settings enable row level security;
alter table public.social_follows enable row level security;
alter table public.knowledge_reactions enable row level security;
alter table public.knowledge_comments enable row level security;

drop policy if exists "public read public profiles" on public.public_profile_settings;
drop policy if exists "users manage own public profile" on public.public_profile_settings;
drop policy if exists "public read active follows" on public.social_follows;
drop policy if exists "users manage own follows" on public.social_follows;
drop policy if exists "public read knowledge reactions" on public.knowledge_reactions;
drop policy if exists "users manage own reactions" on public.knowledge_reactions;
drop policy if exists "public read active comments" on public.knowledge_comments;
drop policy if exists "users manage own comments" on public.knowledge_comments;

create policy "public read public profiles"
on public.public_profile_settings for select
using (visibility in ('public', 'unlisted') or profile_id = auth.uid());

create policy "users manage own public profile"
on public.public_profile_settings for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "public read active follows"
on public.social_follows for select
using (status = 'active' or follower_profile_id = auth.uid());

create policy "users manage own follows"
on public.social_follows for all
using (follower_profile_id = auth.uid())
with check (follower_profile_id = auth.uid());

create policy "public read knowledge reactions"
on public.knowledge_reactions for select
using (
  exists (
    select 1
    from public.knowledge_assets asset
    where asset.id = knowledge_reactions.asset_id
      and asset.status = 'published'
      and asset.visibility in ('public', 'chivo_approved')
  )
  or profile_id = auth.uid()
);

create policy "users manage own reactions"
on public.knowledge_reactions for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "public read active comments"
on public.knowledge_comments for select
using (
  status = 'active'
  and exists (
    select 1
    from public.knowledge_assets asset
    where asset.id = knowledge_comments.asset_id
      and asset.status = 'published'
      and asset.visibility in ('public', 'chivo_approved')
  )
  or profile_id = auth.uid()
);

create policy "users manage own comments"
on public.knowledge_comments for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
