import { supabase } from '../lib/supabase';

export type KnowledgePublishAction = 'listMine' | 'saveDraft' | 'publish' | 'submitReview' | 'archive' | 'reviewAsset';
export type PublishAssetType = 'article' | 'lesson' | 'research_paper' | 'study' | 'report' | 'publication';
export type PublishVisibility = 'private' | 'unlisted' | 'public' | 'chivo_approved';
export type PublishAccessMode = 'free' | 'paid' | 'holders_only' | 'sponsors_only' | 'disabled';
export type PublishOwnershipMode = 'none' | 'membership_pass' | 'limited_editions' | 'open_editions' | 'certificate';

export type PublishedKnowledgeAsset = {
  id: string;
  assetType: PublishAssetType;
  slug: string | null;
  title: string;
  summary: string | null;
  body: string;
  language: string;
  tags: string[];
  creatorProfileId: string | null;
  schoolId: string | null;
  visibility: PublishVisibility;
  accessMode: PublishAccessMode;
  ownershipMode: PublishOwnershipMode;
  aiReviewStatus: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeDraftInput = {
  assetId?: string;
  assetType: PublishAssetType;
  title: string;
  slug?: string;
  summary?: string;
  body: string;
  language?: string;
  tags?: string[];
  schoolId?: string | null;
  visibility?: Exclude<PublishVisibility, 'chivo_approved'>;
  accessMode?: PublishAccessMode;
  ownershipMode?: PublishOwnershipMode;
};

export async function fetchMyKnowledgeAssets(): Promise<PublishedKnowledgeAsset[]> {
  const data = await invokeKnowledgePublishing({ action: 'listMine' });
  return readAssets(data);
}

export async function saveKnowledgeDraft(input: KnowledgeDraftInput): Promise<PublishedKnowledgeAsset> {
  const data = await invokeKnowledgePublishing({ action: 'saveDraft', ...input });
  return readAsset(data);
}

export async function publishKnowledgeAsset(input: KnowledgeDraftInput): Promise<PublishedKnowledgeAsset> {
  const data = await invokeKnowledgePublishing({ action: 'publish', ...input });
  return readAsset(data);
}

export async function submitKnowledgeAssetForReview(assetId: string): Promise<PublishedKnowledgeAsset> {
  const data = await invokeKnowledgePublishing({ action: 'submitReview', assetId });
  return readAsset(data);
}

export async function archiveKnowledgeAsset(assetId: string): Promise<PublishedKnowledgeAsset> {
  const data = await invokeKnowledgePublishing({ action: 'archive', assetId });
  return readAsset(data);
}

async function invokeKnowledgePublishing(payload: Record<string, unknown>) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await (supabase as any).functions.invoke('knowledge-publishing', {
    body: payload,
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data;
}

function readAsset(value: unknown): PublishedKnowledgeAsset {
  const record = readObject(value);
  return normalizeAsset(readObject(record.asset));
}

function readAssets(value: unknown): PublishedKnowledgeAsset[] {
  const record = readObject(value);
  const assets = Array.isArray(record.assets) ? record.assets : [];
  return assets.map((asset) => normalizeAsset(readObject(asset)));
}

function normalizeAsset(record: Record<string, unknown>): PublishedKnowledgeAsset {
  return {
    id: String(record.id ?? ''),
    assetType: normalizeAssetType(record.assetType),
    slug: readString(record.slug),
    title: readString(record.title) ?? 'Untitled',
    summary: readString(record.summary),
    body: readString(record.body) ?? '',
    language: readString(record.language) ?? 'en',
    tags: Array.isArray(record.tags) ? record.tags.map((tag) => String(tag)) : [],
    creatorProfileId: readString(record.creatorProfileId),
    schoolId: readString(record.schoolId),
    visibility: normalizeVisibility(record.visibility),
    accessMode: normalizeAccessMode(record.accessMode),
    ownershipMode: normalizeOwnershipMode(record.ownershipMode),
    aiReviewStatus: readString(record.aiReviewStatus) ?? 'not_submitted',
    status: readString(record.status) ?? 'draft',
    metadata: readObject(record.metadata),
    createdAt: readString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: readString(record.updatedAt) ?? new Date(0).toISOString(),
  };
}

function normalizeAssetType(value: unknown): PublishAssetType {
  return value === 'lesson' ||
    value === 'research_paper' ||
    value === 'study' ||
    value === 'report' ||
    value === 'publication'
    ? value
    : 'article';
}

function normalizeVisibility(value: unknown): PublishVisibility {
  return value === 'unlisted' || value === 'public' || value === 'chivo_approved' ? value : 'private';
}

function normalizeAccessMode(value: unknown): PublishAccessMode {
  return value === 'paid' || value === 'holders_only' || value === 'sponsors_only' || value === 'disabled'
    ? value
    : 'free';
}

function normalizeOwnershipMode(value: unknown): PublishOwnershipMode {
  return value === 'membership_pass' || value === 'limited_editions' || value === 'open_editions' || value === 'certificate'
    ? value
    : 'none';
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
