-- Chivo AI Group 13 upgrade for 2.0 monetization controls.
-- Run this before wiring paid school/class/crew access into app flows.
-- This creates the database-backed control plane. Onchain payment listeners and
-- production contracts/programs will be added after this policy layer exists.

insert into public.platform_settings (key, value, description)
values (
  'billing_control',
  '{
    "billing_enabled": true,
    "platform_fee_bps": 50,
    "crypto_rails_enabled": false,
    "traditional_rails_enabled": false,
    "message": null
  }'::jsonb,
  'Controls global billing enforcement, payment rails, and Chivo platform fee.'
)
on conflict (key) do update
set
  value = excluded.value || public.platform_settings.value,
  description = excluded.description,
  updated_at = now();

create table if not exists public.company_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'operator',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_admins_role_check check (
    role in ('super_admin', 'owner', 'admin', 'operator', 'reviewer', 'finance')
  ),
  constraint company_admins_status_check check (status in ('active', 'suspended', 'removed'))
);

alter table public.company_admins
drop constraint if exists company_admins_role_check;

alter table public.company_admins
add constraint company_admins_role_check check (
  role in ('super_admin', 'owner', 'admin', 'operator', 'reviewer', 'finance')
);

create table if not exists public.company_admin_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  permission text not null,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, permission),
  constraint company_admin_role_permissions_role_check check (
    role in ('super_admin', 'owner', 'admin', 'operator', 'reviewer', 'finance')
  )
);

alter table public.company_admin_role_permissions
drop constraint if exists company_admin_role_permissions_role_check;

alter table public.company_admin_role_permissions
add constraint company_admin_role_permissions_role_check check (
  role in ('super_admin', 'owner', 'admin', 'operator', 'reviewer', 'finance')
);

insert into public.profiles (id, full_name, preferred_language, learning_level, audio_enabled)
select
  user_record.id,
  coalesce(user_record.raw_user_meta_data ->> 'full_name', user_record.email, 'Chivo AI Admin'),
  coalesce(user_record.raw_user_meta_data ->> 'preferred_language', 'English'),
  coalesce(user_record.raw_user_meta_data ->> 'learning_level', 'balanced'),
  case
    when user_record.raw_user_meta_data ->> 'audio_enabled' in ('true', 'false')
      then (user_record.raw_user_meta_data ->> 'audio_enabled')::boolean
    else true
  end
from auth.users user_record
where user_record.id = '97b9ceaf-c8a4-45db-ac6c-101467ecc039'
on conflict (id) do update
set
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  updated_at = now();

insert into public.company_admins (profile_id, role, status, metadata)
values (
  '97b9ceaf-c8a4-45db-ac6c-101467ecc039',
  'super_admin',
  'active',
  '{"email": "chivodotai@gmail.com", "seeded_by": "group13"}'::jsonb
)
on conflict (profile_id) do update
set
  role = 'super_admin',
  status = 'active',
  metadata = public.company_admins.metadata || excluded.metadata,
  updated_at = now();

insert into public.company_admin_role_permissions (role, permission)
values
  ('super_admin', 'platform.full_control'),
  ('owner', 'platform.settings.read'),
  ('owner', 'billing.manage'),
  ('owner', 'access.manage'),
  ('owner', 'policy.manage'),
  ('owner', 'verification.manage'),
  ('owner', 'payments.review'),
  ('owner', 'contracts.read'),
  ('owner', 'content.review'),
  ('owner', 'admin.read'),
  ('admin', 'platform.settings.read'),
  ('admin', 'access.manage'),
  ('admin', 'policy.manage'),
  ('admin', 'verification.manage'),
  ('admin', 'payments.review'),
  ('admin', 'content.review'),
  ('admin', 'admin.read'),
  ('finance', 'billing.manage'),
  ('finance', 'payment_rails.manage'),
  ('finance', 'payments.review'),
  ('finance', 'ledgers.read'),
  ('reviewer', 'policy.review'),
  ('reviewer', 'content.review'),
  ('reviewer', 'verification.review'),
  ('operator', 'support.review'),
  ('operator', 'access.read')
on conflict (role, permission) do nothing;

create table if not exists public.company_admin_dashboard_passwords (
  profile_id uuid primary key references public.company_admins(profile_id) on delete cascade,
  password_hash text not null,
  password_salt text not null,
  iterations integer not null default 210000,
  algorithm text not null default 'PBKDF2-SHA256',
  status text not null default 'active',
  password_set_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_admin_dashboard_passwords_algorithm_check check (algorithm = 'PBKDF2-SHA256'),
  constraint company_admin_dashboard_passwords_status_check check (status in ('active', 'reset_required', 'disabled')),
  constraint company_admin_dashboard_passwords_iterations_check check (iterations >= 100000)
);

create table if not exists public.company_admin_dashboard_sessions (
  token_hash text primary key,
  profile_id uuid not null references public.company_admins(profile_id) on delete cascade,
  status text not null default 'active',
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_admin_dashboard_sessions_status_check check (status in ('active', 'revoked', 'expired'))
);

create table if not exists public.platform_policy_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  profile_id uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  crew_id uuid references public.lesson_crews(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_entity_restrictions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  restriction_type text not null,
  status text not null default 'active',
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_entity_restrictions_entity_type_check check (
    entity_type in ('profile', 'school', 'class', 'crew', 'publication', 'payment_rail', 'wallet')
  ),
  constraint platform_entity_restrictions_type_check check (
    restriction_type in ('ban', 'suspension', 'hide', 'payout_freeze', 'payment_freeze', 'review_hold')
  ),
  constraint platform_entity_restrictions_status_check check (status in ('active', 'expired', 'revoked'))
);

create table if not exists public.platform_access_overrides (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  target_entity_type text,
  target_entity_id uuid,
  profile_id uuid references public.profiles(id) on delete cascade,
  effect text not null,
  status text not null default 'active',
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_access_overrides_scope_check check (
    scope in ('platform', 'school', 'class', 'crew', 'subject', 'verification', 'payment_rail', 'publication')
  ),
  constraint platform_access_overrides_target_type_check check (
    target_entity_type is null
    or target_entity_type in ('school', 'class', 'crew', 'subject', 'profile', 'publication', 'payment_rail')
  ),
  constraint platform_access_overrides_effect_check check (
    effect in ('grant', 'deny', 'force_free', 'force_paid', 'waive_fee', 'verified', 'remove_verified')
  ),
  constraint platform_access_overrides_status_check check (status in ('active', 'expired', 'revoked'))
);

create table if not exists public.payment_rail_settings (
  id uuid primary key default gen_random_uuid(),
  rail_type text not null,
  provider text not null,
  chain text,
  status text not null default 'disabled',
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rail_type, provider, chain),
  constraint payment_rail_settings_type_check check (rail_type in ('crypto', 'traditional')),
  constraint payment_rail_settings_status_check check (status in ('enabled', 'disabled', 'paused', 'review'))
);

create table if not exists public.access_products (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  name text not null,
  access_mode text not null default 'free',
  billing_period text not null default 'one_time',
  amount numeric(18, 6) not null default 0,
  currency text not null default 'USD',
  payment_rails jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_products_entity_type_check check (
    entity_type in ('school', 'class', 'crew', 'subject', 'verification', 'donation', 'publication')
  ),
  constraint access_products_access_mode_check check (access_mode in ('free', 'paid', 'disabled')),
  constraint access_products_billing_period_check check (
    billing_period in ('one_time', 'weekly', 'monthly', 'yearly', 'custom')
  ),
  constraint access_products_status_check check (status in ('active', 'paused', 'archived'))
);

create table if not exists public.access_passes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.access_products(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  school_membership_id uuid references public.school_memberships(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  source text not null default 'free',
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoke_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_passes_entity_type_check check (entity_type in ('school', 'class', 'crew', 'subject', 'publication')),
  constraint access_passes_source_check check (source in ('free', 'paid', 'override', 'admin', 'migration')),
  constraint access_passes_status_check check (status in ('active', 'pending', 'expired', 'revoked'))
);

create table if not exists public.embedded_wallet_identities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  wallet_type text not null default 'embedded',
  evm_address text,
  solana_address text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, profile_id),
  constraint embedded_wallet_identities_wallet_type_check check (wallet_type in ('embedded', 'external')),
  constraint embedded_wallet_identities_status_check check (status in ('active', 'disabled', 'review'))
);

create table if not exists public.onchain_payment_intents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.access_products(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  chain text not null,
  token_symbol text not null,
  expected_amount numeric(36, 18) not null,
  expected_receiver text not null,
  payer_address text,
  status text not null default 'created',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onchain_payment_intents_entity_type_check check (entity_type in ('school', 'class', 'crew', 'subject', 'verification', 'donation', 'publication')),
  constraint onchain_payment_intents_status_check check (
    status in ('created', 'awaiting_payment', 'observed', 'confirmed', 'rejected', 'expired', 'cancelled')
  )
);

create table if not exists public.onchain_payment_events (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid references public.onchain_payment_intents(id) on delete set null,
  chain text not null,
  tx_hash text not null,
  payer_address text,
  receiver_address text,
  amount numeric(36, 18) not null,
  token_symbol text not null,
  block_number numeric,
  slot numeric,
  confirmations integer not null default 0,
  finality_status text not null default 'observed',
  status text not null default 'observed',
  rejection_reason text,
  raw_event jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (chain, tx_hash),
  constraint onchain_payment_events_finality_check check (
    finality_status in ('observed', 'confirmed', 'finalized', 'rejected')
  ),
  constraint onchain_payment_events_status_check check (
    status in ('observed', 'confirmed', 'rejected', 'ignored')
  )
);

create table if not exists public.contract_program_registry (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  address text not null,
  kind text not null,
  status text not null default 'draft',
  audit_status text not null default 'not_started',
  version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain, address),
  constraint contract_program_registry_kind_check check (kind in ('evm_contract', 'solana_program')),
  constraint contract_program_registry_status_check check (status in ('draft', 'testnet', 'active', 'paused', 'retired')),
  constraint contract_program_registry_audit_check check (audit_status in ('not_started', 'internal_review', 'external_review', 'approved', 'rejected'))
);

create index if not exists platform_entity_restrictions_lookup_idx
on public.platform_entity_restrictions(entity_type, entity_id, status, starts_at, ends_at);

create index if not exists company_admin_dashboard_sessions_profile_idx
on public.company_admin_dashboard_sessions(profile_id, status, expires_at desc);

create index if not exists platform_access_overrides_lookup_idx
on public.platform_access_overrides(target_entity_type, target_entity_id, profile_id, effect, status, starts_at, ends_at);

create index if not exists access_products_entity_idx
on public.access_products(entity_type, entity_id, status);

create index if not exists access_passes_profile_entity_idx
on public.access_passes(profile_id, entity_type, entity_id, status, starts_at, ends_at);

create index if not exists onchain_payment_intents_profile_idx
on public.onchain_payment_intents(profile_id, status, created_at desc);

create index if not exists onchain_payment_events_intent_idx
on public.onchain_payment_events(intent_id, status, observed_at desc);

do $$ begin
  create trigger company_admins_set_updated_at
  before update on public.company_admins
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger company_admin_role_permissions_set_updated_at
  before update on public.company_admin_role_permissions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger company_admin_dashboard_passwords_set_updated_at
  before update on public.company_admin_dashboard_passwords
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger company_admin_dashboard_sessions_set_updated_at
  before update on public.company_admin_dashboard_sessions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger platform_entity_restrictions_set_updated_at
  before update on public.platform_entity_restrictions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger platform_access_overrides_set_updated_at
  before update on public.platform_access_overrides
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger payment_rail_settings_set_updated_at
  before update on public.payment_rail_settings
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger access_products_set_updated_at
  before update on public.access_products
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger access_passes_set_updated_at
  before update on public.access_passes
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger embedded_wallet_identities_set_updated_at
  before update on public.embedded_wallet_identities
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger onchain_payment_intents_set_updated_at
  before update on public.onchain_payment_intents
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger contract_program_registry_set_updated_at
  before update on public.contract_program_registry
  for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

create or replace function public.company_admin_role_rank(role_name text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case role_name
    when 'super_admin' then 100
    when 'owner' then 80
    when 'admin' then 70
    when 'finance' then 50
    when 'reviewer' then 40
    when 'operator' then 30
    else 0
  end;
$$;

create or replace function public.current_company_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ca.role
  from public.company_admins ca
  where ca.profile_id = auth.uid()
    and ca.status = 'active'
  order by public.company_admin_role_rank(ca.role) desc
  limit 1;
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_company_admin_role() is not null;
$$;

create or replace function public.is_company_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_company_admin_role() = 'super_admin';
$$;

create or replace function public.company_admin_has_permission(required_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  admin_role text;
begin
  admin_role := public.current_company_admin_role();

  if admin_role is null then
    return false;
  end if;

  if admin_role = 'super_admin' then
    return true;
  end if;

  return exists (
    select 1
    from public.company_admin_role_permissions permission_record
    where permission_record.role = admin_role
      and permission_record.permission = required_permission
      and permission_record.enabled = true
  );
end;
$$;

create or replace function public.has_company_admin_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_admins ca
    where ca.profile_id = auth.uid()
      and ca.status = 'active'
      and (
        ca.role = 'super_admin'
        or ca.role = any(required_roles)
      )
  );
$$;

create or replace function public.company_admin_dashboard_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'passwordSet',
    exists (
      select 1
      from public.company_admin_dashboard_passwords password_record
      where password_record.profile_id = auth.uid()
        and password_record.status = 'active'
    ),
    'required',
    public.current_company_admin_role() is not null
  );
$$;

create or replace function public.platform_billing_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (value ->> 'billing_enabled')::boolean
      from public.platform_settings
      where key = 'billing_control'
    ),
    true
  );
$$;

create or replace function public.active_entity_restriction(
  target_entity_type text,
  target_entity_id uuid
)
returns public.platform_entity_restrictions
language sql
stable
security definer
set search_path = public
as $$
  select restriction.*
  from public.platform_entity_restrictions restriction
  where restriction.entity_type = target_entity_type
    and restriction.entity_id = target_entity_id
    and restriction.status = 'active'
    and restriction.starts_at <= now()
    and (restriction.ends_at is null or restriction.ends_at > now())
  order by restriction.created_at desc
  limit 1;
$$;

create or replace function public.evaluate_access_policy(
  target_entity_type text,
  target_entity_id uuid,
  target_profile_id uuid default auth.uid()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  billing_on boolean := true;
  profile_restriction public.platform_entity_restrictions;
  entity_restriction public.platform_entity_restrictions;
  active_override public.platform_access_overrides;
  product_record public.access_products;
  pass_record public.access_passes;
begin
  if target_profile_id is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'signed_out',
      'paymentRequired', false,
      'source', 'auth'
    );
  end if;

  billing_on := coalesce(public.platform_billing_enabled(), true);

  select * into profile_restriction
  from public.active_entity_restriction('profile', target_profile_id);

  if profile_restriction.id is not null then
    return jsonb_build_object(
      'allowed', false,
      'reason', profile_restriction.restriction_type,
      'paymentRequired', false,
      'source', 'restriction',
      'restrictionId', profile_restriction.id
    );
  end if;

  select * into entity_restriction
  from public.active_entity_restriction(target_entity_type, target_entity_id);

  if entity_restriction.id is not null then
    return jsonb_build_object(
      'allowed', false,
      'reason', entity_restriction.restriction_type,
      'paymentRequired', false,
      'source', 'restriction',
      'restrictionId', entity_restriction.id
    );
  end if;

  select *
  into active_override
  from public.platform_access_overrides override_record
  where (override_record.target_entity_type = target_entity_type or override_record.target_entity_type is null)
    and (override_record.target_entity_id = target_entity_id or override_record.target_entity_id is null)
    and (override_record.profile_id = target_profile_id or override_record.profile_id is null)
    and override_record.effect in ('deny', 'grant', 'force_free')
    and override_record.status = 'active'
    and override_record.starts_at <= now()
    and (override_record.ends_at is null or override_record.ends_at > now())
  order by
    case override_record.effect when 'deny' then 0 when 'grant' then 1 else 2 end,
    override_record.created_at desc
  limit 1;

  if active_override.id is not null and active_override.effect = 'deny' then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'override_denied',
      'paymentRequired', false,
      'source', 'override',
      'overrideId', active_override.id
    );
  end if;

  if active_override.id is not null and active_override.effect in ('grant', 'force_free') then
    return jsonb_build_object(
      'allowed', true,
      'reason', active_override.effect,
      'paymentRequired', false,
      'source', 'override',
      'overrideId', active_override.id
    );
  end if;

  if billing_on is false then
    return jsonb_build_object(
      'allowed', true,
      'reason', 'billing_disabled',
      'paymentRequired', false,
      'source', 'platform'
    );
  end if;

  select *
  into pass_record
  from public.access_passes access_pass
  where access_pass.profile_id = target_profile_id
    and access_pass.entity_type = target_entity_type
    and access_pass.entity_id = target_entity_id
    and access_pass.status = 'active'
    and access_pass.starts_at <= now()
    and (access_pass.ends_at is null or access_pass.ends_at > now())
  order by access_pass.created_at desc
  limit 1;

  if pass_record.id is not null then
    return jsonb_build_object(
      'allowed', true,
      'reason', 'active_pass',
      'paymentRequired', false,
      'source', 'access_pass',
      'passId', pass_record.id
    );
  end if;

  select *
  into product_record
  from public.access_products product
  where product.entity_type = target_entity_type
    and product.entity_id = target_entity_id
    and product.status = 'active'
  order by product.created_at desc
  limit 1;

  if product_record.id is null or product_record.access_mode = 'free' then
    return jsonb_build_object(
      'allowed', true,
      'reason', 'free_access',
      'paymentRequired', false,
      'source', 'product',
      'productId', product_record.id
    );
  end if;

  if product_record.access_mode = 'disabled' then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'access_disabled',
      'paymentRequired', false,
      'source', 'product',
      'productId', product_record.id
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'reason', 'payment_required',
    'paymentRequired', true,
    'source', 'product',
    'productId', product_record.id,
    'amount', product_record.amount,
    'currency', product_record.currency,
    'billingPeriod', product_record.billing_period,
    'paymentRails', product_record.payment_rails
  );
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
  access_policy jsonb;
  access_reason text;
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

  access_policy := public.evaluate_access_policy('crew', target_crew.id, viewer_id);

  if coalesce((access_policy ->> 'allowed')::boolean, true) is false then
    access_reason := access_policy ->> 'reason';

    if coalesce((access_policy ->> 'paymentRequired')::boolean, false) then
      raise exception 'Payment is required to join this crew.';
    end if;

    if access_reason = 'ban' then
      raise exception 'Access to this crew is not available for this account.';
    elsif access_reason = 'suspension' then
      raise exception 'Access to this crew is paused for this account.';
    elsif access_reason = 'override_denied' then
      raise exception 'Access to this crew has been restricted.';
    elsif access_reason = 'access_disabled' then
      raise exception 'This crew is not accepting access right now.';
    else
      raise exception 'Access to this crew is not available right now.';
    end if;
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

alter table public.company_admins enable row level security;
alter table public.company_admin_role_permissions enable row level security;
alter table public.company_admin_dashboard_passwords enable row level security;
alter table public.company_admin_dashboard_sessions enable row level security;
alter table public.platform_policy_audit_logs enable row level security;
alter table public.platform_entity_restrictions enable row level security;
alter table public.platform_access_overrides enable row level security;
alter table public.payment_rail_settings enable row level security;
alter table public.access_products enable row level security;
alter table public.access_passes enable row level security;
alter table public.embedded_wallet_identities enable row level security;
alter table public.onchain_payment_intents enable row level security;
alter table public.onchain_payment_events enable row level security;
alter table public.contract_program_registry enable row level security;

drop policy if exists "company admins read company admins" on public.company_admins;
drop policy if exists "company admins read role permissions" on public.company_admin_role_permissions;
drop policy if exists "company admins read own dashboard sessions" on public.company_admin_dashboard_sessions;
drop policy if exists "company admins read platform audit logs" on public.platform_policy_audit_logs;
drop policy if exists "company admins read restrictions" on public.platform_entity_restrictions;
drop policy if exists "company admins read overrides" on public.platform_access_overrides;
drop policy if exists "authenticated users read active payment rails" on public.payment_rail_settings;
drop policy if exists "company admins read payment rails" on public.payment_rail_settings;
drop policy if exists "users and school admins read access products" on public.access_products;
drop policy if exists "users read own access passes" on public.access_passes;
drop policy if exists "school admins read school access passes" on public.access_passes;
drop policy if exists "users read own embedded wallets" on public.embedded_wallet_identities;
drop policy if exists "users read own payment intents" on public.onchain_payment_intents;
drop policy if exists "users read own payment events" on public.onchain_payment_events;
drop policy if exists "company admins read contract registry" on public.contract_program_registry;

create policy "company admins read company admins"
on public.company_admins for select
using (public.is_company_super_admin() or profile_id = auth.uid());

create policy "company admins read role permissions"
on public.company_admin_role_permissions for select
using (
  public.is_company_super_admin()
  or exists (
    select 1
    from public.company_admins ca
    where ca.profile_id = auth.uid()
      and ca.status = 'active'
      and ca.role = company_admin_role_permissions.role
  )
);

create policy "company admins read own dashboard sessions"
on public.company_admin_dashboard_sessions for select
using (profile_id = auth.uid());

create policy "company admins read platform audit logs"
on public.platform_policy_audit_logs for select
using (
  public.company_admin_has_permission('policy.manage')
  or public.company_admin_has_permission('payments.review')
);

create policy "company admins read restrictions"
on public.platform_entity_restrictions for select
using (
  public.company_admin_has_permission('policy.manage')
  or public.company_admin_has_permission('policy.review')
);

create policy "company admins read overrides"
on public.platform_access_overrides for select
using (
  public.company_admin_has_permission('access.manage')
  or public.company_admin_has_permission('policy.manage')
);

create policy "authenticated users read active payment rails"
on public.payment_rail_settings for select
using (auth.role() = 'authenticated' and status = 'enabled');

create policy "company admins read payment rails"
on public.payment_rail_settings for select
using (
  public.company_admin_has_permission('payment_rails.manage')
  or public.company_admin_has_permission('billing.manage')
);

create policy "users and school admins read access products"
on public.access_products for select
using (
  status = 'active'
  or public.company_admin_has_permission('access.read')
  or public.company_admin_has_permission('access.manage')
  or (
    school_id is not null
    and public.has_school_role(school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "users read own access passes"
on public.access_passes for select
using (
  profile_id = auth.uid()
  or public.company_admin_has_permission('access.read')
  or public.company_admin_has_permission('access.manage')
);

create policy "school admins read school access passes"
on public.access_passes for select
using (
  school_membership_id is not null
  and exists (
    select 1
    from public.school_memberships sm
    where sm.id = access_passes.school_membership_id
      and public.has_school_role(sm.school_id, array['owner', 'admin']::public.school_role[])
  )
);

create policy "users read own embedded wallets"
on public.embedded_wallet_identities for select
using (
  profile_id = auth.uid()
  or public.company_admin_has_permission('payments.review')
);

create policy "users read own payment intents"
on public.onchain_payment_intents for select
using (
  profile_id = auth.uid()
  or public.company_admin_has_permission('payments.review')
);

create policy "users read own payment events"
on public.onchain_payment_events for select
using (
  public.company_admin_has_permission('payments.review')
  or exists (
    select 1
    from public.onchain_payment_intents intent
    where intent.id = onchain_payment_events.intent_id
      and intent.profile_id = auth.uid()
  )
);

create policy "company admins read contract registry"
on public.contract_program_registry for select
using (
  public.company_admin_has_permission('contracts.read')
  or public.company_admin_has_permission('payments.review')
);

revoke execute on function public.company_admin_role_rank(text) from public;
revoke execute on function public.current_company_admin_role() from public;
revoke execute on function public.is_company_admin() from public;
revoke execute on function public.is_company_super_admin() from public;
revoke execute on function public.company_admin_has_permission(text) from public;
revoke execute on function public.has_company_admin_role(text[]) from public;
revoke execute on function public.company_admin_dashboard_state() from public;
revoke execute on function public.platform_billing_enabled() from public;
revoke execute on function public.active_entity_restriction(text, uuid) from public;
revoke execute on function public.evaluate_access_policy(text, uuid, uuid) from public;
revoke execute on function public.join_crew_by_code(text, uuid) from public;

grant execute on function public.current_company_admin_role() to authenticated;
grant execute on function public.is_company_admin() to authenticated;
grant execute on function public.is_company_super_admin() to authenticated;
grant execute on function public.company_admin_has_permission(text) to authenticated;
grant execute on function public.has_company_admin_role(text[]) to authenticated;
grant execute on function public.company_admin_dashboard_state() to authenticated;
grant execute on function public.platform_billing_enabled() to authenticated;
grant execute on function public.evaluate_access_policy(text, uuid, uuid) to authenticated;
grant execute on function public.join_crew_by_code(text, uuid) to authenticated;
