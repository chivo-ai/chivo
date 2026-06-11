import { supabase } from '../lib/supabase';

export type AccessEntityType = 'school' | 'class' | 'crew' | 'subject' | 'publication' | 'knowledge_asset' | 'membership_pass';

export type AccessPolicyResult = {
  allowed: boolean;
  reason: string;
  paymentRequired: boolean;
  source: string;
  productId: string | null;
  passId: string | null;
  overrideId: string | null;
  restrictionId: string | null;
  amount: number | string | null;
  currency: string | null;
  billingPeriod: string | null;
  paymentRails: unknown;
};

export type PlatformBillingControl = {
  billingEnabled: boolean;
  platformFeeBps: number;
  cryptoRailsEnabled: boolean;
  traditionalRailsEnabled: boolean;
  message: string | null;
};

export type PaymentRailSetting = {
  id: string;
  railType: 'crypto' | 'traditional';
  provider: string;
  chain: string | null;
  status: 'enabled' | 'disabled' | 'paused' | 'review';
  displayName: string;
  config: Record<string, unknown>;
};

const defaultBillingControl: PlatformBillingControl = {
  billingEnabled: true,
  platformFeeBps: 50,
  cryptoRailsEnabled: false,
  traditionalRailsEnabled: false,
  message: null,
};

const defaultAccessPolicy: AccessPolicyResult = {
  allowed: true,
  reason: 'policy_unavailable',
  paymentRequired: false,
  source: 'fallback',
  productId: null,
  passId: null,
  overrideId: null,
  restrictionId: null,
  amount: null,
  currency: null,
  billingPeriod: null,
  paymentRails: [],
};

function isMissingPolicyError(error: { code?: string } | null | undefined) {
  return error?.code === '42P01' || error?.code === '42883' || error?.code === 'PGRST202';
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeBillingControl(value: unknown): PlatformBillingControl {
  const record = readObject(value);

  return {
    billingEnabled: readBoolean(record.billing_enabled ?? record.billingEnabled, defaultBillingControl.billingEnabled),
    platformFeeBps: readNumber(record.platform_fee_bps ?? record.platformFeeBps, defaultBillingControl.platformFeeBps),
    cryptoRailsEnabled: readBoolean(
      record.crypto_rails_enabled ?? record.cryptoRailsEnabled,
      defaultBillingControl.cryptoRailsEnabled,
    ),
    traditionalRailsEnabled: readBoolean(
      record.traditional_rails_enabled ?? record.traditionalRailsEnabled,
      defaultBillingControl.traditionalRailsEnabled,
    ),
    message: readString(record.message),
  };
}

function normalizeAccessPolicy(value: unknown): AccessPolicyResult {
  const record = readObject(value);

  return {
    allowed: readBoolean(record.allowed, defaultAccessPolicy.allowed),
    reason: readString(record.reason) ?? defaultAccessPolicy.reason,
    paymentRequired: readBoolean(
      record.paymentRequired ?? record.payment_required,
      defaultAccessPolicy.paymentRequired,
    ),
    source: readString(record.source) ?? defaultAccessPolicy.source,
    productId: readString(record.productId ?? record.product_id),
    passId: readString(record.passId ?? record.pass_id),
    overrideId: readString(record.overrideId ?? record.override_id),
    restrictionId: readString(record.restrictionId ?? record.restriction_id),
    amount: typeof record.amount === 'number' || typeof record.amount === 'string' ? record.amount : null,
    currency: readString(record.currency),
    billingPeriod: readString(record.billingPeriod ?? record.billing_period),
    paymentRails: record.paymentRails ?? record.payment_rails ?? defaultAccessPolicy.paymentRails,
  };
}

function normalizePaymentRail(row: Record<string, unknown>): PaymentRailSetting {
  return {
    id: String(row.id),
    railType: row.rail_type === 'traditional' ? 'traditional' : 'crypto',
    provider: readString(row.provider) ?? 'unknown',
    chain: readString(row.chain),
    status:
      row.status === 'disabled' || row.status === 'paused' || row.status === 'review' ? row.status : 'enabled',
    displayName: readString(row.display_name) ?? readString(row.provider) ?? 'Payment rail',
    config: readObject(row.config),
  };
}

export async function fetchPlatformBillingControl(): Promise<PlatformBillingControl> {
  if (!supabase) {
    return defaultBillingControl;
  }

  const { data, error } = await (supabase as any)
    .from('platform_settings')
    .select('value')
    .eq('key', 'billing_control')
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      return defaultBillingControl;
    }

    throw error;
  }

  return normalizeBillingControl(data?.value);
}

export async function evaluateAccessPolicy(
  entityType: AccessEntityType,
  entityId: string,
  profileId?: string | null,
): Promise<AccessPolicyResult> {
  if (!supabase) {
    return {
      ...defaultAccessPolicy,
      reason: 'supabase_unconfigured',
    };
  }

  const payload: Record<string, string> = {
    target_entity_type: entityType,
    target_entity_id: entityId,
  };

  if (profileId) {
    payload.target_profile_id = profileId;
  }

  const { data, error } = await (supabase as any).rpc('evaluate_access_policy', payload);

  if (error) {
    if (isMissingPolicyError(error)) {
      return defaultAccessPolicy;
    }

    throw error;
  }

  return normalizeAccessPolicy(data);
}

export async function fetchEnabledPaymentRails(): Promise<PaymentRailSetting[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('payment_rail_settings')
    .select('id, rail_type, provider, chain, status, display_name, config')
    .eq('status', 'enabled')
    .order('display_name', { ascending: true });

  if (error) {
    if (error.code === '42P01') {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizePaymentRail);
}
