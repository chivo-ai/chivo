import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type PublishAction = 'listMine' | 'saveDraft' | 'publish' | 'submitReview' | 'archive' | 'reviewAsset';
type AssetType = 'article' | 'lesson' | 'research_paper' | 'study' | 'report' | 'publication';
type Visibility = 'private' | 'unlisted' | 'public' | 'chivo_approved';
type AccessMode = 'free' | 'paid' | 'holders_only' | 'sponsors_only' | 'disabled';
type OwnershipMode = 'none' | 'membership_pass' | 'limited_editions' | 'open_editions' | 'certificate';

type PublishRequest = {
  action?: PublishAction;
  assetId?: string;
  assetType?: AssetType;
  title?: string;
  slug?: string;
  summary?: string;
  body?: string;
  language?: string;
  tags?: string[];
  schoolId?: string | null;
  visibility?: Visibility;
  accessMode?: AccessMode;
  ownershipMode?: OwnershipMode;
  reviewStatus?: 'approved' | 'rejected' | 'needs_changes';
  reviewNotes?: string;
};

type KnowledgeAssetRow = {
  id: string;
  asset_type: AssetType;
  slug: string | null;
  title: string;
  summary: string | null;
  creator_profile_id: string | null;
  school_id: string | null;
  visibility: Visibility;
  access_mode: AccessMode;
  ownership_mode: OwnershipMode;
  ai_review_status: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const assetTypes = new Set(['article', 'lesson', 'research_paper', 'study', 'report', 'publication']);
const userVisibilities = new Set(['private', 'unlisted', 'public']);
const accessModes = new Set(['free', 'paid', 'holders_only', 'sponsors_only', 'disabled']);
const ownershipModes = new Set(['none', 'membership_pass', 'limited_editions', 'open_editions', 'certificate']);
const reviewStatuses = new Set(['approved', 'rejected', 'needs_changes']);

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return json({ error: 'Authentication is required.' }, 401);
    }

    const serviceRoleKey = getServiceRoleKey();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    if (!serviceRoleKey || !supabaseUrl) {
      return json({ error: 'Knowledge publishing is not configured.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session.' }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as PublishRequest;

    switch (body.action) {
      case 'listMine':
        return json(await listMine(supabase, user.id));
      case 'saveDraft':
        return json(await saveAsset(supabase, user.id, body, 'draft'));
      case 'publish':
        return json(await saveAsset(supabase, user.id, body, 'published'));
      case 'submitReview':
        return json(await submitReview(supabase, user.id, body));
      case 'archive':
        return json(await archiveAsset(supabase, user.id, body));
      case 'reviewAsset':
        return json(await reviewAsset(supabase, user.id, body));
      default:
        return json({ error: 'Unsupported publishing action.' }, 400);
    }
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Knowledge publishing action failed.' }, 500);
  }
});

async function listMine(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from('knowledge_assets')
    .select('id, asset_type, slug, title, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .eq('creator_profile_id', profileId)
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) {
    throw error;
  }

  return { assets: (data ?? []).map(cleanAsset) };
}

async function saveAsset(
  supabase: SupabaseClient,
  profileId: string,
  body: PublishRequest,
  nextStatus: 'draft' | 'published',
) {
  const existing = body.assetId ? await fetchEditableAsset(supabase, profileId, body.assetId) : null;
  const existingMetadata = readObject(existing?.metadata);
  const assetType = normalizeAssetType(body.assetType ?? existing?.asset_type);
  const title = cleanRequiredString(body.title ?? existing?.title, 'Title');
  const summary = cleanString(body.summary ?? existing?.summary);
  const schoolId = await resolveSchoolId(supabase, profileId, body.schoolId ?? existing?.school_id ?? null);
  const existingUserVisibility = existing?.visibility === 'chivo_approved' ? 'public' : existing?.visibility;
  const requestedVisibility = body.visibility ?? existingUserVisibility ?? (nextStatus === 'published' ? 'public' : 'private');
  const visibility = normalizeUserVisibility(requestedVisibility);
  const accessMode = normalizeAccessMode(body.accessMode ?? existing?.access_mode ?? 'free');
  const ownershipMode = normalizeOwnershipMode(body.ownershipMode ?? existing?.ownership_mode ?? 'none');
  const nextBody = cleanString(body.body) ?? readString(existingMetadata.body) ?? '';
  const nextLanguage = cleanString(body.language) ?? readString(existingMetadata.language) ?? 'en';
  const nextTags = cleanTags(body.tags ?? readArray(existingMetadata.tags));
  const contentChanged = Boolean(existing) && (
    title !== existing?.title ||
    (summary ?? '') !== (existing?.summary ?? '') ||
    nextBody !== (readString(existingMetadata.body) ?? '') ||
    nextLanguage !== (readString(existingMetadata.language) ?? 'en') ||
    JSON.stringify(nextTags) !== JSON.stringify(cleanTags(readArray(existingMetadata.tags)))
  );
  const aiReviewStatus = existing?.ai_review_status === 'approved' && contentChanged
    ? 'needs_changes'
    : existing?.ai_review_status ?? 'not_submitted';
  const safeVisibility = resolveSavedVisibility(existing?.visibility, visibility, contentChanged);
  const slug = await createUniqueSlug(
    supabase,
    assetType,
    body.slug ?? existing?.slug ?? title,
    existing?.id ?? null,
  );
  const metadata = {
    ...existingMetadata,
    body: nextBody,
    language: nextLanguage,
    tags: nextTags,
    contentFormat: 'markdown',
    savedAt: new Date().toISOString(),
  };

  const payload = {
    asset_type: assetType,
    title,
    slug,
    summary,
    creator_profile_id: profileId,
    school_id: schoolId,
    visibility: safeVisibility,
    access_mode: accessMode,
    ownership_mode: ownershipMode,
    ai_review_status: aiReviewStatus,
    status: nextStatus,
    metadata,
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? supabase.from('knowledge_assets').update(payload).eq('id', existing.id)
    : supabase.from('knowledge_assets').insert(payload);

  const { data, error } = await query
    .select('id, asset_type, slug, title, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, profileId, existing ? 'knowledge.asset.updated' : 'knowledge.asset.created', data.id, {
    status: nextStatus,
    assetType,
  });

  return { asset: cleanAsset(data as KnowledgeAssetRow) };
}

async function submitReview(supabase: SupabaseClient, profileId: string, body: PublishRequest) {
  const asset = await fetchEditableAsset(supabase, profileId, cleanRequiredString(body.assetId, 'Asset ID'));
  const metadata = {
    ...readObject(asset.metadata),
    reviewSubmittedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('knowledge_assets')
    .update({
      status: asset.status === 'draft' ? 'published' : asset.status,
      visibility: asset.visibility === 'private' ? 'public' : asset.visibility,
      ai_review_status: 'queued',
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', asset.id)
    .select('id, asset_type, slug, title, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, profileId, 'knowledge.asset.review_submitted', asset.id, {});
  return { asset: cleanAsset(data as KnowledgeAssetRow) };
}

async function archiveAsset(supabase: SupabaseClient, profileId: string, body: PublishRequest) {
  const asset = await fetchEditableAsset(supabase, profileId, cleanRequiredString(body.assetId, 'Asset ID'));
  const { data, error } = await supabase
    .from('knowledge_assets')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', asset.id)
    .select('id, asset_type, slug, title, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, profileId, 'knowledge.asset.archived', asset.id, {});
  return { asset: cleanAsset(data as KnowledgeAssetRow) };
}

async function reviewAsset(supabase: SupabaseClient, profileId: string, body: PublishRequest) {
  await requireCompanyPermission(supabase, profileId, ['knowledge.review', 'marketplace.manage']);

  const assetId = cleanRequiredString(body.assetId, 'Asset ID');
  const reviewStatus = normalizeReviewStatus(body.reviewStatus);
  const { data: existing, error: existingError } = await supabase
    .from('knowledge_assets')
    .select('metadata')
    .eq('id', assetId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw new Error('Knowledge asset was not found.');
  }

  const metadataPatch = {
    reviewNotes: cleanString(body.reviewNotes),
    reviewedAt: new Date().toISOString(),
    reviewedBy: profileId,
  };
  const metadata = {
    ...readObject(existing?.metadata),
    ...metadataPatch,
  };

  const { data, error } = await supabase
    .from('knowledge_assets')
    .update({
      ai_review_status: reviewStatus,
      visibility: reviewStatus === 'approved' ? 'chivo_approved' : 'public',
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId)
    .select('id, asset_type, slug, title, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, profileId, `knowledge.asset.review_${reviewStatus}`, assetId, metadataPatch);
  return { asset: cleanAsset(data as KnowledgeAssetRow) };
}

async function fetchEditableAsset(supabase: SupabaseClient, profileId: string, assetId: string): Promise<KnowledgeAssetRow> {
  const { data, error } = await supabase
    .from('knowledge_assets')
    .select('id, asset_type, slug, title, summary, creator_profile_id, school_id, visibility, access_mode, ownership_mode, ai_review_status, status, metadata, created_at, updated_at')
    .eq('id', assetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Knowledge asset was not found.');
  }

  const asset = data as KnowledgeAssetRow;
  if (asset.creator_profile_id === profileId || (asset.school_id && await canPublishForSchool(supabase, profileId, asset.school_id))) {
    return asset;
  }

  throw new Error('You cannot edit this knowledge asset.');
}

async function resolveSchoolId(supabase: SupabaseClient, profileId: string, schoolId: string | null) {
  if (!schoolId) {
    return null;
  }

  if (!(await canPublishForSchool(supabase, profileId, schoolId))) {
    throw new Error('School publishing requires owner, admin, or teacher access.');
  }

  return schoolId;
}

async function canPublishForSchool(supabase: SupabaseClient, profileId: string, schoolId: string) {
  const { data, error } = await supabase
    .from('school_memberships')
    .select('id')
    .eq('school_id', schoolId)
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'teacher'])
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function requireCompanyPermission(supabase: SupabaseClient, profileId: string, permissions: string[]) {
  const { data: admin, error } = await supabase
    .from('company_admins')
    .select('role, status')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!admin) {
    throw new Error('Company review access is required.');
  }

  if (admin.role === 'super_admin') {
    return;
  }

  const { data, error: permissionError } = await supabase
    .from('company_admin_role_permissions')
    .select('permission')
    .eq('role', admin.role)
    .eq('enabled', true)
    .in('permission', permissions);

  if (permissionError) {
    throw permissionError;
  }

  if (!data?.length) {
    throw new Error('Company review permission is required.');
  }
}

async function createUniqueSlug(
  supabase: SupabaseClient,
  assetType: AssetType,
  value: string,
  currentAssetId: string | null,
) {
  const base = slugify(value) || 'knowledge';

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase
      .from('knowledge_assets')
      .select('id')
      .eq('asset_type', assetType)
      .eq('slug', slug);

    if (currentAssetId) {
      query = query.neq('id', currentAssetId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return slug;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function audit(
  supabase: SupabaseClient,
  actorProfileId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.from('platform_policy_audit_logs').insert({
    actor_profile_id: actorProfileId,
    action,
    entity_type: 'knowledge_asset',
    entity_id: entityId,
    metadata,
  });

  if (error) {
    throw error;
  }
}

function cleanAsset(row: KnowledgeAssetRow) {
  const metadata = readObject(row.metadata);

  return {
    id: row.id,
    assetType: row.asset_type,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: readString(metadata.body) ?? '',
    language: readString(metadata.language) ?? 'en',
    tags: cleanTags(readArray(metadata.tags)),
    creatorProfileId: row.creator_profile_id,
    schoolId: row.school_id,
    visibility: row.visibility,
    accessMode: row.access_mode,
    ownershipMode: row.ownership_mode,
    aiReviewStatus: row.ai_review_status,
    status: row.status,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAssetType(value: unknown): AssetType {
  if (typeof value === 'string' && assetTypes.has(value)) {
    return value as AssetType;
  }

  return 'article';
}

function normalizeUserVisibility(value: unknown): Visibility {
  if (typeof value === 'string' && userVisibilities.has(value)) {
    return value as Visibility;
  }

  return 'private';
}

function resolveSavedVisibility(
  existingVisibility: Visibility | undefined,
  nextVisibility: Visibility,
  contentChanged: boolean,
): Visibility {
  if (existingVisibility !== 'chivo_approved') {
    return nextVisibility;
  }

  if (contentChanged) {
    return 'public';
  }

  return nextVisibility === 'private' || nextVisibility === 'unlisted' ? nextVisibility : 'chivo_approved';
}

function normalizeAccessMode(value: unknown): AccessMode {
  if (typeof value === 'string' && accessModes.has(value)) {
    return value as AccessMode;
  }

  return 'free';
}

function normalizeOwnershipMode(value: unknown): OwnershipMode {
  if (typeof value === 'string' && ownershipModes.has(value)) {
    return value as OwnershipMode;
  }

  return 'none';
}

function normalizeReviewStatus(value: unknown) {
  if (typeof value === 'string' && reviewStatuses.has(value)) {
    return value;
  }

  throw new Error('Review status is invalid.');
}

function cleanTags(value: unknown[]) {
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanRequiredString(value: unknown, label: string) {
  const cleaned = cleanString(value);
  if (!cleaned) {
    throw new Error(`${label} is required.`);
  }

  return cleaned;
}

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 72);
}

function getServiceRoleKey() {
  return Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
