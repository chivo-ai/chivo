import { supabase } from '../lib/supabase';
import {
  fetchPlatformBillingControl,
  PaymentRailSetting,
  PlatformBillingControl,
} from './accessControl';
import {
  CompanyAdminRole,
  CompanyAdminSession,
  CompanyAdminStatus,
  fetchCurrentCompanyAdminSession,
} from './companyAdmin';

export type CompanyAdminRow = {
  profileId: string;
  role: CompanyAdminRole;
  status: CompanyAdminStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CompanyRestrictionRow = {
  id: string;
  entityType: string;
  entityId: string;
  restrictionType: string;
  status: string;
  reason: string | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
};

export type CompanyOverrideRow = {
  id: string;
  scope: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  profileId: string | null;
  effect: string;
  status: string;
  reason: string | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
};

export type PlatformFeePolicyRow = {
  id: string;
  feeType: string;
  entityType: string | null;
  provider: string | null;
  chain: string | null;
  currency: string | null;
  basisPoints: number;
  status: string;
};

export type CompanyControlDashboard = {
  session: CompanyAdminSession | null;
  billing: PlatformBillingControl;
  paymentRails: PaymentRailSetting[];
  feePolicies: PlatformFeePolicyRow[];
  admins: CompanyAdminRow[];
  restrictions: CompanyRestrictionRow[];
  overrides: CompanyOverrideRow[];
};

export type UpdateBillingControlInput = {
  billingEnabled: boolean;
  cryptoRailsEnabled: boolean;
  traditionalRailsEnabled: boolean;
  platformFeeBps: number;
  message?: string | null;
};

export type UpsertCompanyAdminInput = {
  profileId: string;
  role: CompanyAdminRole;
  status: CompanyAdminStatus;
};

export type UpdatePlatformFeePolicyInput = {
  policyId: string;
  basisPoints: number;
  status?: 'active' | 'paused' | 'archived';
};

export type CreateRestrictionInput = {
  entityType:
    | 'profile'
    | 'school'
    | 'class'
    | 'crew'
    | 'publication'
    | 'payment_rail'
    | 'wallet'
    | 'knowledge_asset'
    | 'membership_pass'
    | 'funding_campaign'
    | 'donation_target';
  entityId: string;
  restrictionType: 'ban' | 'suspension' | 'hide' | 'payout_freeze' | 'payment_freeze' | 'review_hold';
  reason?: string | null;
  endsAt?: string | null;
};

export type DashboardUnlockResult = {
  dashboardSessionToken: string;
  expiresAt: string;
};

export type CreateOverrideInput = {
  scope:
    | 'platform'
    | 'school'
    | 'class'
    | 'crew'
    | 'subject'
    | 'verification'
    | 'payment_rail'
    | 'publication'
    | 'knowledge_asset'
    | 'membership_pass'
    | 'funding_campaign'
    | 'donation';
  effect: 'grant' | 'deny' | 'force_free' | 'force_paid' | 'waive_fee' | 'verified' | 'remove_verified';
  targetEntityType?:
    | 'school'
    | 'class'
    | 'crew'
    | 'subject'
    | 'profile'
    | 'publication'
    | 'payment_rail'
    | 'knowledge_asset'
    | 'membership_pass'
    | 'funding_campaign'
    | 'donation_target'
    | null;
  targetEntityId?: string | null;
  profileId?: string | null;
  reason?: string | null;
  endsAt?: string | null;
};

const emptyDashboard: CompanyControlDashboard = {
  session: null,
  billing: {
    billingEnabled: true,
    platformFeeBps: 50,
    cryptoRailsEnabled: false,
    traditionalRailsEnabled: false,
    message: null,
  },
  paymentRails: [],
  feePolicies: [],
  admins: [],
  restrictions: [],
  overrides: [],
};

function client() {
  if (!supabase) {
    throw new Error('Company controls are not available right now.');
  }

  return supabase;
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeAdmin(row: Record<string, unknown>): CompanyAdminRow {
  return {
    profileId: String(row.profile_id),
    role: normalizeRole(row.role),
    status: normalizeStatus(row.status),
    metadata: readObject(row.metadata),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function normalizeRestriction(row: Record<string, unknown>): CompanyRestrictionRow {
  return {
    id: String(row.id),
    entityType: String(row.entity_type ?? ''),
    entityId: String(row.entity_id ?? ''),
    restrictionType: String(row.restriction_type ?? ''),
    status: String(row.status ?? ''),
    reason: nullableString(row.reason),
    startsAt: String(row.starts_at ?? ''),
    endsAt: nullableString(row.ends_at),
    createdAt: String(row.created_at ?? ''),
  };
}

function normalizeOverride(row: Record<string, unknown>): CompanyOverrideRow {
  return {
    id: String(row.id),
    scope: String(row.scope ?? ''),
    targetEntityType: nullableString(row.target_entity_type),
    targetEntityId: nullableString(row.target_entity_id),
    profileId: nullableString(row.profile_id),
    effect: String(row.effect ?? ''),
    status: String(row.status ?? ''),
    reason: nullableString(row.reason),
    startsAt: String(row.starts_at ?? ''),
    endsAt: nullableString(row.ends_at),
    createdAt: String(row.created_at ?? ''),
  };
}

function normalizeFeePolicy(row: Record<string, unknown>): PlatformFeePolicyRow {
  return {
    id: String(row.id),
    feeType: String(row.fee_type ?? ''),
    entityType: nullableString(row.entity_type),
    provider: nullableString(row.provider),
    chain: nullableString(row.chain),
    currency: nullableString(row.currency),
    basisPoints: readNumber(row.basis_points, 50),
    status: String(row.status ?? 'active'),
  };
}

function readNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRole(value: unknown): CompanyAdminRole {
  if (
    value === 'super_admin' ||
    value === 'owner' ||
    value === 'admin' ||
    value === 'finance' ||
    value === 'reviewer' ||
    value === 'operator'
  ) {
    return value;
  }

  return 'operator';
}

function normalizeStatus(value: unknown): CompanyAdminStatus {
  if (value === 'suspended' || value === 'removed') {
    return value;
  }

  return 'active';
}

async function safeList<T>(loader: () => Promise<T[]>): Promise<T[]> {
  try {
    return await loader();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === '42P01' || code === '42501' || code === 'PGRST205') {
      return [];
    }

    throw error;
  }
}

export async function fetchCompanyControlDashboard(): Promise<CompanyControlDashboard> {
  if (!supabase) {
    return emptyDashboard;
  }

  const session = await fetchCurrentCompanyAdminSession();

  if (!session?.isActive) {
    return {
      ...emptyDashboard,
      session,
    };
  }

  const [billing, paymentRails, feePolicies, admins, restrictions, overrides] = await Promise.all([
    fetchPlatformBillingControl(),
    safeList(fetchCompanyPaymentRails),
    safeList(fetchPlatformFeePolicies),
    safeList(fetchCompanyAdmins),
    safeList(fetchActiveRestrictions),
    safeList(fetchActiveOverrides),
  ]);

  return {
    session,
    billing,
    paymentRails,
    feePolicies,
    admins,
    restrictions,
    overrides,
  };
}

export async function fetchCompanyAdmins(): Promise<CompanyAdminRow[]> {
  const { data, error } = await (client() as any)
    .from('company_admins')
    .select('profile_id, role, status, metadata, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeAdmin);
}

export async function fetchCompanyPaymentRails(): Promise<PaymentRailSetting[]> {
  const { data, error } = await (client() as any)
    .from('payment_rail_settings')
    .select('id, rail_type, provider, chain, status, display_name, config')
    .order('display_name', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    railType: row.rail_type === 'traditional' ? 'traditional' : 'crypto',
    provider: nullableString(row.provider) ?? 'unknown',
    chain: nullableString(row.chain),
    status:
      row.status === 'disabled' || row.status === 'paused' || row.status === 'review' ? row.status : 'enabled',
    displayName: nullableString(row.display_name) ?? nullableString(row.provider) ?? 'Payment rail',
    config: readObject(row.config),
  }));
}

export async function fetchPlatformFeePolicies(): Promise<PlatformFeePolicyRow[]> {
  const { data, error } = await (client() as any)
    .from('platform_fee_policies')
    .select('id, fee_type, entity_type, provider, chain, currency, basis_points, status')
    .order('fee_type', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeFeePolicy);
}

export async function fetchActiveRestrictions(): Promise<CompanyRestrictionRow[]> {
  const { data, error } = await (client() as any)
    .from('platform_entity_restrictions')
    .select('id, entity_type, entity_id, restriction_type, status, reason, starts_at, ends_at, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeRestriction);
}

export async function fetchActiveOverrides(): Promise<CompanyOverrideRow[]> {
  const { data, error } = await (client() as any)
    .from('platform_access_overrides')
    .select('id, scope, target_entity_type, target_entity_id, profile_id, effect, status, reason, starts_at, ends_at, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeOverride);
}

export async function setCompanyDashboardPassword(input: { password: string; currentPassword?: string | null }) {
  return invokeCompanyControl('setDashboardPassword', input);
}

export async function unlockCompanyDashboard(password: string): Promise<DashboardUnlockResult> {
  const data = await invokeCompanyControl('unlockDashboard', { password });
  const record = readObject(data);

  return {
    dashboardSessionToken: String(record.dashboardSessionToken ?? ''),
    expiresAt: String(record.expiresAt ?? ''),
  };
}

export async function updateCompanyBillingControl(input: UpdateBillingControlInput, dashboardSessionToken: string) {
  return invokeCompanyControl('updateBillingControl', { ...input, dashboardSessionToken });
}

export async function upsertCompanyAdmin(input: UpsertCompanyAdminInput, dashboardSessionToken: string) {
  return invokeCompanyControl('upsertCompanyAdmin', { ...input, dashboardSessionToken });
}

export async function updatePlatformFeePolicy(input: UpdatePlatformFeePolicyInput, dashboardSessionToken: string) {
  return invokeCompanyControl('updatePlatformFeePolicy', { ...input, dashboardSessionToken });
}

export async function createCompanyRestriction(input: CreateRestrictionInput, dashboardSessionToken: string) {
  return invokeCompanyControl('createRestriction', { ...input, dashboardSessionToken });
}

export async function createCompanyOverride(input: CreateOverrideInput, dashboardSessionToken: string) {
  return invokeCompanyControl('createOverride', { ...input, dashboardSessionToken });
}

async function invokeCompanyControl(action: string, payload: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke('company-control', {
    body: {
      action,
      ...payload,
    },
  });

  if (error) {
    await throwFunctionError(error, 'Company action could not be completed.');
  }

  return data;
}

async function throwFunctionError(error: unknown, fallback: string): Promise<never> {
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;

  if (context?.json) {
    try {
      const body = await context.json();
      if (body && typeof body === 'object' && 'error' in body) {
        const message = String((body as { error?: unknown }).error ?? '').trim();
        if (message) {
          throw new Error(message);
        }
      }
    } catch (caught) {
      if (caught instanceof Error && caught.message) {
        throw caught;
      }
    }
  }

  if (error instanceof Error && error.message && !error.message.includes('non-2xx')) {
    throw error;
  }

  throw new Error(fallback);
}
