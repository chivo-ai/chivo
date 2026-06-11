import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CompanyAdminRole = 'super_admin' | 'owner' | 'admin' | 'operator' | 'reviewer' | 'finance';

type CompanyAdmin = {
  profile_id: string;
  role: CompanyAdminRole;
  status: string;
};

type DashboardPasswordRecord = {
  profile_id: string;
  password_hash: string;
  password_salt: string;
  iterations: number;
  algorithm: string;
  status: string;
};

type ControlRequest = {
  action?: string;
  [key: string]: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const adminRoles = new Set(['super_admin', 'owner', 'admin', 'operator', 'reviewer', 'finance']);
const adminStatuses = new Set(['active', 'suspended', 'removed']);
const feePolicyStatuses = new Set(['active', 'paused', 'archived']);
const entityTypes = new Set([
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
  'donation_target',
]);
const restrictionTypes = new Set(['ban', 'suspension', 'hide', 'payout_freeze', 'payment_freeze', 'review_hold']);
const overrideScopes = new Set([
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
  'donation',
]);
const overrideEffects = new Set(['grant', 'deny', 'force_free', 'force_paid', 'waive_fee', 'verified', 'remove_verified']);
const overrideTargetTypes = new Set([
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
  'donation_target',
]);
const dashboardSessionHours = 8;

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
    if (!serviceRoleKey) {
      return json({ error: 'Company controls are not available right now.' }, 500);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session.' }, 401);
    }

    const admin = await getCompanyAdmin(supabase, user.id);
    if (!admin) {
      return json({ error: 'Company access is required.' }, 403);
    }

    const body = (await request.json()) as ControlRequest;

    switch (body.action) {
      case 'setDashboardPassword':
        return json(await setDashboardPassword(supabase, admin, body));
      case 'unlockDashboard':
        return json(await unlockDashboard(supabase, admin, body));
      case 'updateBillingControl':
        await requireDashboardSession(supabase, admin, body);
        return json(await updateBillingControl(supabase, admin, body));
      case 'upsertCompanyAdmin':
        await requireDashboardSession(supabase, admin, body);
        return json(await upsertCompanyAdmin(supabase, admin, body));
      case 'updatePlatformFeePolicy':
        await requireDashboardSession(supabase, admin, body);
        return json(await updatePlatformFeePolicy(supabase, admin, body));
      case 'createRestriction':
        await requireDashboardSession(supabase, admin, body);
        return json(await createRestriction(supabase, admin, body));
      case 'createOverride':
        await requireDashboardSession(supabase, admin, body);
        return json(await createOverride(supabase, admin, body));
      default:
        return json({ error: 'Unsupported company action.' }, 400);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Action could not be completed.' }, 500);
  }
});

async function getCompanyAdmin(supabase: SupabaseClient, profileId: string): Promise<CompanyAdmin | null> {
  const { data, error } = await supabase
    .from('company_admins')
    .select('profile_id, role, status')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CompanyAdmin | null;
}

async function requirePermission(supabase: SupabaseClient, admin: CompanyAdmin, permissions: string[]) {
  if (admin.role === 'super_admin') {
    return;
  }

  const { data, error } = await supabase
    .from('company_admin_role_permissions')
    .select('permission')
    .eq('role', admin.role)
    .eq('enabled', true)
    .in('permission', permissions);

  if (error) {
    throw error;
  }

  if (!data?.length) {
    throw new Error('You do not have permission for this action.');
  }
}

function requireSuperAdmin(admin: CompanyAdmin) {
  if (admin.role !== 'super_admin') {
    throw new Error('Super admin access is required.');
  }
}

async function setDashboardPassword(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  const password = cleanRequiredString(body.password, 'Dashboard password');
  const currentPassword = cleanString(body.currentPassword);

  if (password.length < 10) {
    throw new Error('Use at least 10 characters for the dashboard password.');
  }

  const existing = await getDashboardPassword(supabase, admin.profile_id);
  if (existing && !(await verifyDashboardPassword(existing, currentPassword ?? ''))) {
    throw new Error('Current dashboard password is incorrect.');
  }

  const salt = randomBase64(24);
  const iterations = 210000;
  const passwordHash = await hashDashboardPassword(password, salt, iterations);

  const { error } = await supabase
    .from('company_admin_dashboard_passwords')
    .upsert({
      profile_id: admin.profile_id,
      password_hash: passwordHash,
      password_salt: salt,
      iterations,
      algorithm: 'PBKDF2-SHA256',
      status: 'active',
      password_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });

  if (error) {
    throw error;
  }

  await revokeDashboardSessions(supabase, admin.profile_id);
  await audit(supabase, admin.profile_id, 'company.dashboard_password.updated', 'profile', admin.profile_id, {});

  return { passwordSet: true };
}

async function unlockDashboard(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  const password = cleanRequiredString(body.password, 'Dashboard password');
  const passwordRecord = await getDashboardPassword(supabase, admin.profile_id);

  if (!passwordRecord) {
    throw new Error('Set a dashboard password first.');
  }

  if (!(await verifyDashboardPassword(passwordRecord, password))) {
    throw new Error('Dashboard password is incorrect.');
  }

  const token = randomBase64Url(32);
  const tokenHash = await sha256Base64(token);
  const expiresAt = new Date(Date.now() + dashboardSessionHours * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('company_admin_dashboard_sessions').insert({
    token_hash: tokenHash,
    profile_id: admin.profile_id,
    status: 'active',
    expires_at: expiresAt,
    last_used_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  await audit(supabase, admin.profile_id, 'company.dashboard.unlocked', 'profile', admin.profile_id, {
    expires_at: expiresAt,
  });

  return {
    dashboardSessionToken: token,
    expiresAt,
  };
}

async function requireDashboardSession(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  const token = cleanString(body.dashboardSessionToken);
  if (!token) {
    throw new Error('Unlock company controls first.');
  }

  const tokenHash = await sha256Base64(token);
  const { data, error } = await supabase
    .from('company_admin_dashboard_sessions')
    .select('token_hash, expires_at, status')
    .eq('token_hash', tokenHash)
    .eq('profile_id', admin.profile_id)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error('Company controls must be unlocked again.');
  }

  const { error: updateError } = await supabase
    .from('company_admin_dashboard_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  if (updateError) {
    throw updateError;
  }
}

async function getDashboardPassword(supabase: SupabaseClient, profileId: string): Promise<DashboardPasswordRecord | null> {
  const { data, error } = await supabase
    .from('company_admin_dashboard_passwords')
    .select('profile_id, password_hash, password_salt, iterations, algorithm, status')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as DashboardPasswordRecord | null;
}

async function revokeDashboardSessions(supabase: SupabaseClient, profileId: string) {
  const { error } = await supabase
    .from('company_admin_dashboard_sessions')
    .update({ status: 'revoked' })
    .eq('profile_id', profileId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }
}

async function updateBillingControl(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  await requirePermission(supabase, admin, ['billing.manage']);

  const nextValue = {
    billing_enabled: Boolean(body.billingEnabled),
    crypto_rails_enabled: Boolean(body.cryptoRailsEnabled),
    traditional_rails_enabled: Boolean(body.traditionalRailsEnabled),
    platform_fee_bps: clampNumber(body.platformFeeBps, 0, 10000, 50),
    message: cleanString(body.message),
  };

  const { data: existing, error: existingError } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'billing_control')
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }

  const merged = {
    ...(isRecord(existing?.value) ? existing.value : {}),
    ...nextValue,
  };

  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      key: 'billing_control',
      value: merged,
      description: 'Controls global billing enforcement, payment rails, and Chivo platform fee.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    throw error;
  }

  await audit(supabase, admin.profile_id, 'company.billing_control.updated', 'platform', null, merged);

  return { billingControl: merged };
}

async function upsertCompanyAdmin(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  requireSuperAdmin(admin);

  const profileId = requireUuid(body.profileId, 'Profile ID');
  const role = requireEnum(body.role, adminRoles, 'Role');
  const status = requireEnum(body.status, adminStatuses, 'Status');

  const { data, error } = await supabase
    .from('company_admins')
    .upsert({
      profile_id: profileId,
      role,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' })
    .select('profile_id, role, status, metadata, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, admin.profile_id, 'company.admin.saved', 'profile', profileId, { role, status });

  return { admin: data };
}

async function updatePlatformFeePolicy(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  await requirePermission(supabase, admin, ['marketplace.fees.manage', 'marketplace.manage', 'billing.manage']);

  const policyId = requireUuid(body.policyId, 'Fee policy ID');
  const basisPoints = clampNumber(body.basisPoints, 0, 2500, 50);
  const status = body.status ? requireEnum(body.status, feePolicyStatuses, 'Fee policy status') : 'active';

  const { data, error } = await supabase
    .from('platform_fee_policies')
    .update({
      basis_points: basisPoints,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', policyId)
    .select('id, fee_type, entity_type, provider, chain, currency, basis_points, status')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, admin.profile_id, 'company.fee_policy.updated', 'fee_policy', policyId, {
    basisPoints,
    status,
  });

  return { feePolicy: data };
}

async function createRestriction(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  await requirePermission(supabase, admin, ['policy.manage']);

  const entityType = requireEnum(body.entityType, entityTypes, 'Entity type');
  const entityId = requireUuid(body.entityId, 'Entity ID');
  const restrictionType = requireEnum(body.restrictionType, restrictionTypes, 'Restriction');
  const reason = cleanString(body.reason);
  const endsAt = cleanIsoDate(body.endsAt);

  const { data, error } = await supabase
    .from('platform_entity_restrictions')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      restriction_type: restrictionType,
      reason,
      ends_at: endsAt,
      created_by: admin.profile_id,
    })
    .select('id, entity_type, entity_id, restriction_type, status, reason, starts_at, ends_at, created_at')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, admin.profile_id, 'company.restriction.created', entityType, entityId, {
    restrictionType,
    reason,
    endsAt,
  });

  return { restriction: data };
}

async function createOverride(supabase: SupabaseClient, admin: CompanyAdmin, body: ControlRequest) {
  await requirePermission(supabase, admin, ['access.manage', 'policy.manage']);

  const scope = requireEnum(body.scope, overrideScopes, 'Scope');
  const effect = requireEnum(body.effect, overrideEffects, 'Effect');
  const targetEntityType = body.targetEntityType ? requireEnum(body.targetEntityType, overrideTargetTypes, 'Target type') : null;
  const targetEntityId = body.targetEntityId ? requireUuid(body.targetEntityId, 'Target ID') : null;
  const profileId = body.profileId ? requireUuid(body.profileId, 'Profile ID') : null;
  const reason = cleanString(body.reason);
  const endsAt = cleanIsoDate(body.endsAt);

  const { data, error } = await supabase
    .from('platform_access_overrides')
    .insert({
      scope,
      effect,
      target_entity_type: targetEntityType,
      target_entity_id: targetEntityId,
      profile_id: profileId,
      reason,
      ends_at: endsAt,
      created_by: admin.profile_id,
    })
    .select('id, scope, target_entity_type, target_entity_id, profile_id, effect, status, reason, starts_at, ends_at, created_at')
    .single();

  if (error) {
    throw error;
  }

  await audit(supabase, admin.profile_id, 'company.override.created', scope, targetEntityId, {
    effect,
    targetEntityType,
    profileId,
    reason,
    endsAt,
  });

  return { override: data };
}

async function audit(
  supabase: SupabaseClient,
  actorProfileId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.from('platform_policy_audit_logs').insert({
    actor_profile_id: actorProfileId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  if (error) {
    throw error;
  }
}

function requireEnum(value: unknown, allowed: Set<string>, label: string) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requireUuid(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())) {
    throw new Error(`${label} is invalid.`);
  }

  return value.trim();
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

function cleanIsoDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Date is invalid.');
  }

  return date.toISOString();
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function hashDashboardPassword(password: string, salt: string, iterations: number) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  return bytesToBase64(new Uint8Array(bits));
}

async function verifyDashboardPassword(record: DashboardPasswordRecord, password: string) {
  if (record.algorithm !== 'PBKDF2-SHA256') {
    return false;
  }

  const nextHash = await hashDashboardPassword(password, record.password_salt, record.iterations);
  return timingSafeEqual(nextHash, record.password_hash);
}

async function sha256Base64(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

function randomBase64(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

function randomBase64Url(byteLength: number) {
  return randomBase64(byteLength).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function getServiceRoleKey() {
  return Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
