import { supabase } from '../lib/supabase';

export type OwnershipProviderType = 'wallet' | 'ownership' | 'minting' | 'marketplace' | 'funding' | 'storage' | 'indexer';
export type ProviderStatus = 'enabled' | 'disabled' | 'paused' | 'review';

export type OwnershipProviderSetting = {
  id: string;
  providerType: OwnershipProviderType;
  provider: string;
  chain: string;
  status: ProviderStatus;
  displayName: string;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type PlatformFeePolicy = {
  id: string;
  feeType: string;
  entityType: string | null;
  provider: string | null;
  chain: string | null;
  currency: string | null;
  basisPoints: number;
  minimumAmount: string | number | null;
  maximumAmount: string | number | null;
  status: 'active' | 'paused' | 'archived';
  metadata: Record<string, unknown>;
};

export type KnowledgeAsset = {
  id: string;
  assetType: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  title: string;
  slug: string | null;
  summary: string | null;
  creatorProfileId: string | null;
  schoolId: string | null;
  visibility: 'private' | 'unlisted' | 'public' | 'chivo_approved';
  accessMode: 'free' | 'paid' | 'holders_only' | 'sponsors_only' | 'disabled';
  ownershipMode: 'none' | 'membership_pass' | 'limited_editions' | 'open_editions' | 'certificate';
  aiReviewStatus: 'not_submitted' | 'queued' | 'in_review' | 'approved' | 'rejected' | 'needs_changes';
  status: 'draft' | 'published' | 'paused' | 'archived' | 'removed';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeAssetCollection = {
  id: string;
  assetId: string;
  providerId: string | null;
  royaltyPolicyId: string | null;
  chain: string | null;
  providerCollectionId: string | null;
  contractAddress: string | null;
  packageId: string | null;
  objectId: string | null;
  standard: string | null;
  maxSupply: string | number | null;
  mintedSupply: string | number;
  status: 'draft' | 'deploying' | 'active' | 'paused' | 'archived' | 'failed';
  metadata: Record<string, unknown>;
};

export type FundingCampaign = {
  id: string;
  assetId: string | null;
  creatorProfileId: string | null;
  schoolId: string | null;
  title: string;
  slug: string | null;
  summary: string | null;
  goalAmount: string | number;
  raisedAmount: string | number;
  currency: string;
  preferredChain: string | null;
  feeBps: number;
  status: 'draft' | 'active' | 'funded' | 'closed' | 'cancelled' | 'failed' | 'under_review';
  startsAt: string | null;
  endsAt: string | null;
  metadata: Record<string, unknown>;
};

export type DonationTarget = {
  id: string;
  entityType: string;
  entityId: string;
  recipientProfileId: string | null;
  schoolId: string | null;
  status: 'active' | 'paused' | 'archived';
  feeBps: number;
  acceptedRails: unknown[];
  metadata: Record<string, unknown>;
};

export type KnowledgeMarketplaceCatalog = {
  ownershipProviders: OwnershipProviderSetting[];
  marketplaceProviders: OwnershipProviderSetting[];
  fundingProviders: OwnershipProviderSetting[];
  feePolicies: PlatformFeePolicy[];
  publicAssets: KnowledgeAsset[];
  fundingCampaigns: FundingCampaign[];
};

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function normalizeProvider(row: Record<string, unknown>): OwnershipProviderSetting {
  const providerType = readString(row.provider_type);
  const status = readString(row.status);

  return {
    id: String(row.id),
    providerType: isProviderType(providerType) ? providerType : 'ownership',
    provider: readString(row.provider) ?? 'unknown',
    chain: readString(row.chain) ?? 'global',
    status: isProviderStatus(status) ? status : 'disabled',
    displayName: readString(row.display_name) ?? readString(row.provider) ?? 'Provider',
    config: readObject(row.config),
    metadata: readObject(row.metadata),
  };
}

function normalizeFeePolicy(row: Record<string, unknown>): PlatformFeePolicy {
  const status = readString(row.status);

  return {
    id: String(row.id),
    feeType: readString(row.fee_type) ?? 'access',
    entityType: readString(row.entity_type),
    provider: readString(row.provider),
    chain: readString(row.chain),
    currency: readString(row.currency),
    basisPoints: readNumber(row.basis_points, 50),
    minimumAmount: (row.minimum_amount as string | number | null) ?? null,
    maximumAmount: (row.maximum_amount as string | number | null) ?? null,
    status: status === 'paused' || status === 'archived' ? status : 'active',
    metadata: readObject(row.metadata),
  };
}

function normalizeAsset(row: Record<string, unknown>): KnowledgeAsset {
  return {
    id: String(row.id),
    assetType: readString(row.asset_type) ?? 'publication',
    sourceEntityType: readString(row.source_entity_type),
    sourceEntityId: readString(row.source_entity_id),
    title: readString(row.title) ?? 'Untitled',
    slug: readString(row.slug),
    summary: readString(row.summary),
    creatorProfileId: readString(row.creator_profile_id),
    schoolId: readString(row.school_id),
    visibility: normalizeAssetVisibility(row.visibility),
    accessMode: normalizeAssetAccessMode(row.access_mode),
    ownershipMode: normalizeOwnershipMode(row.ownership_mode),
    aiReviewStatus: normalizeAiReviewStatus(row.ai_review_status),
    status: normalizeAssetStatus(row.status),
    metadata: readObject(row.metadata),
    createdAt: readString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: readString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeCollection(row: Record<string, unknown>): KnowledgeAssetCollection {
  const status = readString(row.status);

  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    providerId: readString(row.provider_id),
    royaltyPolicyId: readString(row.royalty_policy_id),
    chain: readString(row.chain),
    providerCollectionId: readString(row.provider_collection_id),
    contractAddress: readString(row.contract_address),
    packageId: readString(row.package_id),
    objectId: readString(row.object_id),
    standard: readString(row.standard),
    maxSupply: (row.max_supply as string | number | null) ?? null,
    mintedSupply: (row.minted_supply as string | number | null) ?? 0,
    status:
      status === 'deploying' || status === 'active' || status === 'paused' || status === 'archived' || status === 'failed'
        ? status
        : 'draft',
    metadata: readObject(row.metadata),
  };
}

function normalizeFundingCampaign(row: Record<string, unknown>): FundingCampaign {
  const status = readString(row.status);

  return {
    id: String(row.id),
    assetId: readString(row.asset_id),
    creatorProfileId: readString(row.creator_profile_id),
    schoolId: readString(row.school_id),
    title: readString(row.title) ?? 'Untitled campaign',
    slug: readString(row.slug),
    summary: readString(row.summary),
    goalAmount: (row.goal_amount as string | number | null) ?? 0,
    raisedAmount: (row.raised_amount as string | number | null) ?? 0,
    currency: readString(row.currency) ?? 'POL',
    preferredChain: readString(row.preferred_chain),
    feeBps: readNumber(row.fee_bps, 50),
    status:
      status === 'funded' ||
      status === 'closed' ||
      status === 'cancelled' ||
      status === 'failed' ||
      status === 'under_review'
        ? status
        : status === 'active'
          ? 'active'
          : 'draft',
    startsAt: readString(row.starts_at),
    endsAt: readString(row.ends_at),
    metadata: readObject(row.metadata),
  };
}

function normalizeDonationTarget(row: Record<string, unknown>): DonationTarget {
  const status = readString(row.status);

  return {
    id: String(row.id),
    entityType: readString(row.entity_type) ?? 'publication',
    entityId: String(row.entity_id),
    recipientProfileId: readString(row.recipient_profile_id),
    schoolId: readString(row.school_id),
    status: status === 'paused' || status === 'archived' ? status : 'active',
    feeBps: readNumber(row.fee_bps, 50),
    acceptedRails: readArray(row.accepted_rails),
    metadata: readObject(row.metadata),
  };
}

export async function fetchKnowledgeMarketplaceCatalog(): Promise<KnowledgeMarketplaceCatalog> {
  const [providers, feePolicies, publicAssets, fundingCampaigns] = await Promise.all([
    fetchOwnershipProviders(),
    fetchPlatformFeePolicies(),
    fetchPublicKnowledgeAssets(),
    fetchFundingCampaigns(),
  ]);

  return {
    ownershipProviders: providers.filter((provider) => provider.providerType === 'ownership' || provider.providerType === 'minting'),
    marketplaceProviders: providers.filter((provider) => provider.providerType === 'marketplace'),
    fundingProviders: providers.filter((provider) => provider.providerType === 'funding'),
    feePolicies,
    publicAssets,
    fundingCampaigns,
  };
}

export async function fetchOwnershipProviders(): Promise<OwnershipProviderSetting[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('ownership_provider_settings')
    .select('id, provider_type, provider, chain, status, display_name, config, metadata')
    .order('display_name', { ascending: true });

  if (isMissingTableError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeProvider).sort(sortProviders);
}

export async function fetchPlatformFeePolicies(): Promise<PlatformFeePolicy[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('platform_fee_policies')
    .select('id, fee_type, entity_type, provider, chain, currency, basis_points, minimum_amount, maximum_amount, status, metadata')
    .eq('status', 'active')
    .order('fee_type', { ascending: true });

  if (isMissingTableError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeFeePolicy);
}

export async function fetchPublicKnowledgeAssets(limit = 20): Promise<KnowledgeAsset[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('knowledge_assets')
    .select('id, asset_type, source_entity_type, source_entity_id, title, slug, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .in('visibility', ['public', 'chivo_approved'])
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (isMissingTableError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeAsset);
}

export async function fetchKnowledgeAssetBySlug(assetType: string, slug: string): Promise<KnowledgeAsset | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from('knowledge_assets')
    .select('id, asset_type, source_entity_type, source_entity_id, title, slug, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .eq('asset_type', assetType)
    .eq('slug', slug)
    .maybeSingle();

  if (isMissingTableError(error)) {
    return null;
  }

  if (error) {
    throw error;
  }

  return data ? normalizeAsset(data as Record<string, unknown>) : null;
}

export async function fetchAssetCollections(assetId: string): Promise<KnowledgeAssetCollection[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('knowledge_asset_collections')
    .select('id, asset_id, provider_id, royalty_policy_id, chain, provider_collection_id, contract_address, package_id, object_id, standard, max_supply, minted_supply, status, metadata')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false });

  if (isMissingTableError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeCollection);
}

export async function fetchFundingCampaigns(limit = 20): Promise<FundingCampaign[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('funding_campaigns')
    .select('id, asset_id, creator_profile_id, school_id, title, slug, summary, goal_amount, raised_amount, currency, preferred_chain, fee_bps, status, starts_at, ends_at, metadata')
    .in('status', ['active', 'funded', 'closed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (isMissingTableError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeFundingCampaign);
}

export async function fetchDonationTarget(entityType: string, entityId: string): Promise<DonationTarget | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from('donation_targets')
    .select('id, entity_type, entity_id, recipient_profile_id, school_id, status, fee_bps, accepted_rails, metadata')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (isMissingTableError(error)) {
    return null;
  }

  if (error) {
    throw error;
  }

  return data ? normalizeDonationTarget(data as Record<string, unknown>) : null;
}

function sortProviders(left: OwnershipProviderSetting, right: OwnershipProviderSetting) {
  return left.displayName.localeCompare(right.displayName) || left.chain.localeCompare(right.chain);
}

function isProviderType(value: unknown): value is OwnershipProviderType {
  return (
    value === 'wallet' ||
    value === 'ownership' ||
    value === 'minting' ||
    value === 'marketplace' ||
    value === 'funding' ||
    value === 'storage' ||
    value === 'indexer'
  );
}

function isProviderStatus(value: unknown): value is ProviderStatus {
  return value === 'enabled' || value === 'disabled' || value === 'paused' || value === 'review';
}

function normalizeAssetVisibility(value: unknown): KnowledgeAsset['visibility'] {
  return value === 'unlisted' || value === 'public' || value === 'chivo_approved' ? value : 'private';
}

function normalizeAssetAccessMode(value: unknown): KnowledgeAsset['accessMode'] {
  return value === 'paid' || value === 'holders_only' || value === 'sponsors_only' || value === 'disabled'
    ? value
    : 'free';
}

function normalizeOwnershipMode(value: unknown): KnowledgeAsset['ownershipMode'] {
  return value === 'membership_pass' || value === 'limited_editions' || value === 'open_editions' || value === 'certificate'
    ? value
    : 'none';
}

function normalizeAiReviewStatus(value: unknown): KnowledgeAsset['aiReviewStatus'] {
  return value === 'queued' || value === 'in_review' || value === 'approved' || value === 'rejected' || value === 'needs_changes'
    ? value
    : 'not_submitted';
}

function normalizeAssetStatus(value: unknown): KnowledgeAsset['status'] {
  return value === 'published' || value === 'paused' || value === 'archived' || value === 'removed' ? value : 'draft';
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === '42501' || error?.code === 'PGRST205';
}
