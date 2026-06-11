-- Chivo AI Group 15 upgrade for knowledge ownership and monetization.
-- This keeps Chivo AI crypto-native without creator coins or custom platform tokens.
-- Database records remain the source of truth for content, policy, discovery, and access.
-- Onchain/provider records prove ownership, funding, marketplace events, royalties, and payments.

insert into public.platform_settings (key, value, description)
values (
  'knowledge_marketplace_control',
  '{
    "enabled": false,
    "crypto_only_initial_launch": true,
    "creator_coins_enabled": false,
    "default_access_fee_bps": 50,
    "default_marketplace_fee_bps": 50,
    "default_funding_fee_bps": 50,
    "default_donation_fee_bps": 50,
    "message": null
  }'::jsonb,
  'Controls knowledge marketplace, ownership providers, funding, donations, and fee defaults.'
)
on conflict (key) do update
set
  value = excluded.value || public.platform_settings.value,
  description = excluded.description,
  updated_at = now();

insert into public.company_admin_role_permissions (role, permission)
values
  ('super_admin', 'marketplace.full_control'),
  ('owner', 'marketplace.manage'),
  ('owner', 'ownership.manage'),
  ('owner', 'funding.review'),
  ('owner', 'revenue.read'),
  ('admin', 'marketplace.manage'),
  ('admin', 'ownership.manage'),
  ('admin', 'funding.review'),
  ('finance', 'marketplace.fees.manage'),
  ('finance', 'funding.review'),
  ('finance', 'revenue.read'),
  ('reviewer', 'knowledge.review'),
  ('operator', 'marketplace.read')
on conflict (role, permission) do nothing;

alter table public.platform_entity_restrictions
drop constraint if exists platform_entity_restrictions_entity_type_check;

alter table public.platform_entity_restrictions
add constraint platform_entity_restrictions_entity_type_check check (
  entity_type in (
    'profile',
    'school',
    'class',
    'crew',
    'publication',
    'payment_rail',
    'wallet',
    'knowledge_asset',
    'membership_pass',
    'funding_campaign',
    'donation_target'
  )
);

alter table public.platform_access_overrides
drop constraint if exists platform_access_overrides_scope_check;

alter table public.platform_access_overrides
add constraint platform_access_overrides_scope_check check (
  scope in (
    'platform',
    'school',
    'class',
    'crew',
    'subject',
    'verification',
    'payment_rail',
    'publication',
    'knowledge_asset',
    'membership_pass',
    'funding_campaign',
    'donation'
  )
);

alter table public.platform_access_overrides
drop constraint if exists platform_access_overrides_target_type_check;

alter table public.platform_access_overrides
add constraint platform_access_overrides_target_type_check check (
  target_entity_type is null
  or target_entity_type in (
    'school',
    'class',
    'crew',
    'subject',
    'profile',
    'publication',
    'payment_rail',
    'knowledge_asset',
    'membership_pass',
    'funding_campaign',
    'donation_target'
  )
);

alter table public.access_products
drop constraint if exists access_products_entity_type_check;

alter table public.access_products
add constraint access_products_entity_type_check check (
  entity_type in (
    'school',
    'class',
    'crew',
    'subject',
    'verification',
    'donation',
    'publication',
    'knowledge_asset',
    'membership_pass'
  )
);

alter table public.access_passes
drop constraint if exists access_passes_entity_type_check;

alter table public.access_passes
add constraint access_passes_entity_type_check check (
  entity_type in (
    'school',
    'class',
    'crew',
    'subject',
    'publication',
    'knowledge_asset',
    'membership_pass'
  )
);

alter table public.onchain_payment_intents
drop constraint if exists onchain_payment_intents_entity_type_check;

alter table public.onchain_payment_intents
add constraint onchain_payment_intents_entity_type_check check (
  entity_type in (
    'school',
    'class',
    'crew',
    'subject',
    'verification',
    'donation',
    'publication',
    'knowledge_asset',
    'membership_pass',
    'funding_campaign'
  )
);

create table if not exists public.ownership_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider_type text not null,
  provider text not null,
  chain text not null default 'global',
  status text not null default 'disabled',
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_type, provider, chain),
  constraint ownership_provider_settings_type_check check (
    provider_type in ('wallet', 'ownership', 'minting', 'marketplace', 'funding', 'storage', 'indexer')
  ),
  constraint ownership_provider_settings_status_check check (status in ('enabled', 'disabled', 'paused', 'review'))
);

create table if not exists public.platform_fee_policies (
  id uuid primary key default gen_random_uuid(),
  fee_type text not null,
  entity_type text,
  provider text,
  chain text,
  currency text,
  basis_points integer not null default 50,
  minimum_amount numeric(36, 18),
  maximum_amount numeric(36, 18),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_fee_policies_type_check check (
    fee_type in ('access', 'membership_issue', 'membership_trade', 'knowledge_mint', 'marketplace_sale', 'marketplace_resale', 'funding_success', 'donation', 'verification', 'premium_ai')
  ),
  constraint platform_fee_policies_entity_type_check check (
    entity_type is null
    or entity_type in ('school', 'class', 'crew', 'subject', 'lesson', 'publication', 'research', 'study', 'report', 'knowledge_asset', 'membership_pass', 'membership', 'funding_campaign', 'verification', 'donation')
  ),
  constraint platform_fee_policies_status_check check (status in ('active', 'paused', 'archived')),
  constraint platform_fee_policies_basis_points_check check (basis_points >= 0 and basis_points <= 2500)
);

create table if not exists public.royalty_policies (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  creator_profile_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  provider text,
  chain text,
  royalty_bps integer not null default 500,
  platform_fee_bps integer not null default 50,
  recipient_address text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint royalty_policies_entity_type_check check (
    entity_type in ('membership_pass', 'knowledge_asset', 'publication', 'research', 'study', 'report', 'lesson', 'funding_certificate')
  ),
  constraint royalty_policies_status_check check (status in ('active', 'paused', 'archived')),
  constraint royalty_policies_royalty_bps_check check (royalty_bps >= 0 and royalty_bps <= 10000),
  constraint royalty_policies_platform_fee_bps_check check (platform_fee_bps >= 0 and platform_fee_bps <= 2500)
);

create table if not exists public.knowledge_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  source_entity_type text,
  source_entity_id uuid,
  title text not null,
  slug text,
  summary text,
  creator_profile_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  visibility text not null default 'private',
  access_mode text not null default 'free',
  ownership_mode text not null default 'none',
  ai_review_status text not null default 'not_submitted',
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_type, slug),
  constraint knowledge_assets_asset_type_check check (
    asset_type in ('article', 'lesson', 'research_paper', 'study', 'report', 'publication', 'membership_pass', 'funding_certificate', 'collection')
  ),
  constraint knowledge_assets_source_type_check check (
    source_entity_type is null
    or source_entity_type in ('profile', 'school', 'class', 'crew', 'lesson', 'publication', 'research', 'study', 'report', 'funding_campaign')
  ),
  constraint knowledge_assets_visibility_check check (visibility in ('private', 'unlisted', 'public', 'chivo_approved')),
  constraint knowledge_assets_access_mode_check check (access_mode in ('free', 'paid', 'holders_only', 'sponsors_only', 'disabled')),
  constraint knowledge_assets_ownership_mode_check check (ownership_mode in ('none', 'membership_pass', 'limited_editions', 'open_editions', 'certificate')),
  constraint knowledge_assets_ai_review_status_check check (ai_review_status in ('not_submitted', 'queued', 'in_review', 'approved', 'rejected', 'needs_changes')),
  constraint knowledge_assets_status_check check (status in ('draft', 'published', 'paused', 'archived', 'removed'))
);

create table if not exists public.knowledge_asset_collections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  provider_id uuid references public.ownership_provider_settings(id) on delete set null,
  royalty_policy_id uuid references public.royalty_policies(id) on delete set null,
  chain text,
  provider_collection_id text,
  contract_address text,
  package_id text,
  object_id text,
  standard text,
  max_supply numeric,
  minted_supply numeric not null default 0,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_asset_collections_standard_check check (
    standard is null
    or standard in ('erc721', 'erc1155', 'metaplex_core', 'metaplex_token_metadata', 'sui_object', 'sui_kiosk', 'provider_managed')
  ),
  constraint knowledge_asset_collections_status_check check (status in ('draft', 'deploying', 'active', 'paused', 'archived', 'failed'))
);

create table if not exists public.knowledge_asset_mints (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  collection_id uuid references public.knowledge_asset_collections(id) on delete set null,
  holder_profile_id uuid references public.profiles(id) on delete set null,
  owner_address text,
  chain text not null,
  provider text,
  token_standard text,
  contract_address text,
  token_id text,
  object_id text,
  mint_tx_hash text,
  quantity numeric not null default 1,
  status text not null default 'minted',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_asset_mints_status_check check (status in ('pending', 'minted', 'transferred', 'burned', 'revoked', 'failed')),
  constraint knowledge_asset_mints_quantity_check check (quantity > 0)
);

create table if not exists public.marketplace_trade_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.knowledge_assets(id) on delete set null,
  mint_id uuid references public.knowledge_asset_mints(id) on delete set null,
  provider_id uuid references public.ownership_provider_settings(id) on delete set null,
  chain text not null,
  provider text,
  tx_hash text,
  order_id text,
  event_type text not null,
  buyer_profile_id uuid references public.profiles(id) on delete set null,
  seller_profile_id uuid references public.profiles(id) on delete set null,
  buyer_address text,
  seller_address text,
  gross_amount numeric(36, 18),
  currency text,
  platform_fee_amount numeric(36, 18),
  creator_royalty_amount numeric(36, 18),
  status text not null default 'observed',
  raw_event jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint marketplace_trade_events_type_check check (
    event_type in ('mint', 'primary_sale', 'secondary_sale', 'transfer', 'listing_created', 'listing_cancelled', 'offer_created', 'offer_cancelled', 'royalty_paid', 'fee_paid')
  ),
  constraint marketplace_trade_events_status_check check (status in ('observed', 'confirmed', 'rejected', 'ignored'))
);

create table if not exists public.funding_campaigns (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.knowledge_assets(id) on delete set null,
  creator_profile_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  title text not null,
  slug text unique,
  summary text,
  goal_amount numeric(36, 18) not null,
  raised_amount numeric(36, 18) not null default 0,
  currency text not null,
  preferred_chain text,
  fee_bps integer not null default 50,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_campaigns_status_check check (
    status in ('draft', 'active', 'funded', 'closed', 'cancelled', 'failed', 'under_review')
  ),
  constraint funding_campaigns_goal_check check (goal_amount > 0),
  constraint funding_campaigns_fee_bps_check check (fee_bps >= 0 and fee_bps <= 2500)
);

create table if not exists public.funding_contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.funding_campaigns(id) on delete cascade,
  contributor_profile_id uuid references public.profiles(id) on delete set null,
  payment_intent_id uuid references public.onchain_payment_intents(id) on delete set null,
  chain text not null,
  contributor_address text,
  amount numeric(36, 18) not null,
  currency text not null,
  recognition_tier text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_contributions_status_check check (
    status in ('pending', 'confirmed', 'refunded', 'cancelled', 'rejected')
  ),
  constraint funding_contributions_amount_check check (amount > 0)
);

create table if not exists public.donation_targets (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  status text not null default 'active',
  fee_bps integer not null default 50,
  accepted_rails jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id),
  constraint donation_targets_entity_type_check check (
    entity_type in ('profile', 'school', 'class', 'crew', 'lesson', 'publication', 'research', 'study', 'report', 'knowledge_asset', 'membership_pass')
  ),
  constraint donation_targets_status_check check (status in ('active', 'paused', 'archived')),
  constraint donation_targets_fee_bps_check check (fee_bps >= 0 and fee_bps <= 2500)
);

insert into public.ownership_provider_settings (provider_type, provider, chain, status, display_name, config)
values
  (
    'ownership',
    'crossmint',
    'global',
    'disabled',
    'Crossmint',
    '{
      "supports_evm": true,
      "supports_solana": true,
      "supports_sui": false,
      "managed_minting": true,
      "marketplace_supported": true
    }'::jsonb
  ),
  (
    'marketplace',
    'thirdweb',
    'global',
    'disabled',
    'thirdweb',
    '{
      "supports_evm": true,
      "supports_solana": false,
      "supports_sui": false,
      "marketplace_contracts": true,
      "custom_contract_mode_required_for_fee_control": true
    }'::jsonb
  ),
  (
    'marketplace',
    'reservoir',
    'global',
    'disabled',
    'Reservoir',
    '{
      "supports_evm": true,
      "aggregated_liquidity": true,
      "api_provider": true
    }'::jsonb
  ),
  (
    'ownership',
    'metaplex_core',
    'solana-mainnet',
    'disabled',
    'Metaplex Core',
    '{
      "supports_solana": true,
      "enforced_royalties": true,
      "provider_managed": false
    }'::jsonb
  ),
  (
    'marketplace',
    'sui_kiosk',
    'sui-mainnet',
    'disabled',
    'Sui Kiosk',
    '{
      "supports_sui": true,
      "transfer_policy": true,
      "royalty_rules": true,
      "provider_managed": false
    }'::jsonb
  )
on conflict (provider_type, provider, chain) do update
set
  status = public.ownership_provider_settings.status,
  display_name = excluded.display_name,
  config = excluded.config || public.ownership_provider_settings.config,
  updated_at = now();

insert into public.platform_fee_policies (
  fee_type,
  entity_type,
  provider,
  chain,
  currency,
  basis_points,
  metadata
)
select
  seed.fee_type,
  null,
  null,
  null,
  null,
  seed.basis_points,
  jsonb_build_object('seeded_by', 'group15')
from (
  values
    ('access', 50),
    ('donation', 50),
    ('funding_success', 50),
    ('membership_issue', 50),
    ('membership_trade', 50),
    ('knowledge_mint', 50),
    ('marketplace_sale', 50),
    ('marketplace_resale', 50),
    ('verification', 50),
    ('premium_ai', 50)
) as seed(fee_type, basis_points)
where not exists (
  select 1
  from public.platform_fee_policies policy
  where policy.fee_type = seed.fee_type
    and policy.entity_type is null
    and policy.provider is null
    and policy.chain is null
    and policy.currency is null
);

create index if not exists ownership_provider_settings_lookup_idx
on public.ownership_provider_settings(provider_type, provider, chain, status);

create index if not exists platform_fee_policies_lookup_idx
on public.platform_fee_policies(fee_type, entity_type, provider, chain, status);

create index if not exists royalty_policies_entity_idx
on public.royalty_policies(entity_type, entity_id, status);

create index if not exists knowledge_assets_public_idx
on public.knowledge_assets(visibility, status, asset_type, created_at desc);

create index if not exists knowledge_assets_creator_idx
on public.knowledge_assets(creator_profile_id, status, created_at desc);

create index if not exists knowledge_asset_collections_asset_idx
on public.knowledge_asset_collections(asset_id, status);

create index if not exists knowledge_asset_mints_asset_idx
on public.knowledge_asset_mints(asset_id, status, created_at desc);

create index if not exists knowledge_asset_mints_owner_idx
on public.knowledge_asset_mints(holder_profile_id, owner_address, status);

create index if not exists marketplace_trade_events_asset_idx
on public.marketplace_trade_events(asset_id, chain, status, observed_at desc);

create index if not exists funding_campaigns_public_idx
on public.funding_campaigns(status, preferred_chain, created_at desc);

create index if not exists funding_contributions_campaign_idx
on public.funding_contributions(campaign_id, status, created_at desc);

create index if not exists donation_targets_lookup_idx
on public.donation_targets(entity_type, entity_id, status);

do $$ begin
  create trigger ownership_provider_settings_set_updated_at
  before update on public.ownership_provider_settings
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger platform_fee_policies_set_updated_at
  before update on public.platform_fee_policies
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger royalty_policies_set_updated_at
  before update on public.royalty_policies
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger knowledge_assets_set_updated_at
  before update on public.knowledge_assets
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger knowledge_asset_collections_set_updated_at
  before update on public.knowledge_asset_collections
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger knowledge_asset_mints_set_updated_at
  before update on public.knowledge_asset_mints
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger funding_campaigns_set_updated_at
  before update on public.funding_campaigns
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger funding_contributions_set_updated_at
  before update on public.funding_contributions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger donation_targets_set_updated_at
  before update on public.donation_targets
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

create or replace function public.confirm_funding_contribution_for_intent(
  payment_intent_id_input uuid,
  payment_tx_hash_input text,
  confirmed_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  contribution_record public.funding_contributions;
begin
  select *
  into contribution_record
  from public.funding_contributions
  where payment_intent_id = payment_intent_id_input
  limit 1
  for update;

  if contribution_record.id is null then
    return jsonb_build_object(
      'status', 'missing_contribution',
      'paymentIntentId', payment_intent_id_input
    );
  end if;

  if contribution_record.status = 'confirmed' then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'alreadyConfirmed', true,
      'contributionId', contribution_record.id,
      'campaignId', contribution_record.campaign_id,
      'amount', contribution_record.amount,
      'paymentIntentId', contribution_record.payment_intent_id
    );
  end if;

  if contribution_record.status <> 'pending' then
    return jsonb_build_object(
      'status', 'not_confirmable',
      'currentStatus', contribution_record.status,
      'contributionId', contribution_record.id,
      'campaignId', contribution_record.campaign_id,
      'paymentIntentId', contribution_record.payment_intent_id
    );
  end if;

  update public.funding_contributions
  set
    status = 'confirmed',
    metadata = funding_contributions.metadata
      || confirmed_metadata
      || jsonb_build_object(
        'confirmedAt', now(),
        'paymentTxHash', payment_tx_hash_input
      ),
    updated_at = now()
  where id = contribution_record.id
  returning * into contribution_record;

  update public.funding_campaigns
  set
    raised_amount = raised_amount + contribution_record.amount,
    status = case
      when status = 'active' and raised_amount + contribution_record.amount >= goal_amount then 'funded'
      else status
    end,
    updated_at = now()
  where id = contribution_record.campaign_id;

  return jsonb_build_object(
    'status', 'confirmed',
    'alreadyConfirmed', false,
    'contributionId', contribution_record.id,
    'campaignId', contribution_record.campaign_id,
    'amount', contribution_record.amount,
    'paymentIntentId', contribution_record.payment_intent_id
  );
end;
$$;

revoke execute on function public.confirm_funding_contribution_for_intent(uuid, text, jsonb) from public;
grant execute on function public.confirm_funding_contribution_for_intent(uuid, text, jsonb) to service_role;

alter table public.ownership_provider_settings enable row level security;
alter table public.platform_fee_policies enable row level security;
alter table public.royalty_policies enable row level security;
alter table public.knowledge_assets enable row level security;
alter table public.knowledge_asset_collections enable row level security;
alter table public.knowledge_asset_mints enable row level security;
alter table public.marketplace_trade_events enable row level security;
alter table public.funding_campaigns enable row level security;
alter table public.funding_contributions enable row level security;
alter table public.donation_targets enable row level security;

drop policy if exists "company admins read ownership providers" on public.ownership_provider_settings;
drop policy if exists "company admins read fee policies" on public.platform_fee_policies;
drop policy if exists "company admins and creators read royalty policies" on public.royalty_policies;
drop policy if exists "public and owners read knowledge assets" on public.knowledge_assets;
drop policy if exists "public and owners read knowledge collections" on public.knowledge_asset_collections;
drop policy if exists "public and owners read knowledge mints" on public.knowledge_asset_mints;
drop policy if exists "public read marketplace trade events" on public.marketplace_trade_events;
drop policy if exists "public and owners read funding campaigns" on public.funding_campaigns;
drop policy if exists "contributors and owners read funding contributions" on public.funding_contributions;
drop policy if exists "public and owners read donation targets" on public.donation_targets;

create policy "company admins read ownership providers"
on public.ownership_provider_settings for select
using (
  public.company_admin_has_permission('marketplace.read')
  or public.company_admin_has_permission('marketplace.manage')
  or public.company_admin_has_permission('ownership.manage')
);

create policy "company admins read fee policies"
on public.platform_fee_policies for select
using (
  public.company_admin_has_permission('marketplace.fees.manage')
  or public.company_admin_has_permission('marketplace.manage')
  or public.company_admin_has_permission('revenue.read')
);

create policy "company admins and creators read royalty policies"
on public.royalty_policies for select
using (
  public.company_admin_has_permission('ownership.manage')
  or public.company_admin_has_permission('marketplace.manage')
  or creator_profile_id = auth.uid()
  or (
    school_id is not null
    and public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "public and owners read knowledge assets"
on public.knowledge_assets for select
using (
  (visibility in ('public', 'chivo_approved') and status = 'published')
  or creator_profile_id = auth.uid()
  or public.company_admin_has_permission('knowledge.review')
  or public.company_admin_has_permission('marketplace.manage')
  or (
    school_id is not null
    and public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "public and owners read knowledge collections"
on public.knowledge_asset_collections for select
using (
  public.company_admin_has_permission('ownership.manage')
  or exists (
    select 1
    from public.knowledge_assets asset
    where asset.id = knowledge_asset_collections.asset_id
      and (
        (asset.visibility in ('public', 'chivo_approved') and asset.status = 'published')
        or asset.creator_profile_id = auth.uid()
        or (
          asset.school_id is not null
          and public.has_school_role(asset.school_id, array['owner', 'admin']::public.school_role[])
        )
      )
  )
);

create policy "public and owners read knowledge mints"
on public.knowledge_asset_mints for select
using (
  holder_profile_id = auth.uid()
  or public.company_admin_has_permission('ownership.manage')
  or exists (
    select 1
    from public.knowledge_assets asset
    where asset.id = knowledge_asset_mints.asset_id
      and (
        (asset.visibility in ('public', 'chivo_approved') and asset.status = 'published')
        or asset.creator_profile_id = auth.uid()
        or (
          asset.school_id is not null
          and public.has_school_role(asset.school_id, array['owner', 'admin']::public.school_role[])
        )
      )
  )
);

create policy "public read marketplace trade events"
on public.marketplace_trade_events for select
using (
  status = 'confirmed'
  or buyer_profile_id = auth.uid()
  or seller_profile_id = auth.uid()
  or public.company_admin_has_permission('marketplace.read')
  or public.company_admin_has_permission('marketplace.manage')
);

create policy "public and owners read funding campaigns"
on public.funding_campaigns for select
using (
  status in ('active', 'funded', 'closed')
  or creator_profile_id = auth.uid()
  or public.company_admin_has_permission('funding.review')
  or (
    school_id is not null
    and public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "contributors and owners read funding contributions"
on public.funding_contributions for select
using (
  contributor_profile_id = auth.uid()
  or public.company_admin_has_permission('funding.review')
  or exists (
    select 1
    from public.funding_campaigns campaign
    where campaign.id = funding_contributions.campaign_id
      and (
        campaign.creator_profile_id = auth.uid()
        or (
          campaign.school_id is not null
          and public.has_school_role(campaign.school_id, array['owner', 'admin']::public.school_role[])
        )
      )
  )
);

create policy "public and owners read donation targets"
on public.donation_targets for select
using (
  status = 'active'
  or recipient_profile_id = auth.uid()
  or public.company_admin_has_permission('marketplace.manage')
  or (
    school_id is not null
    and public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
  )
);
