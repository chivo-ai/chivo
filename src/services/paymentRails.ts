import { supabase } from '../lib/supabase';
import { fetchEnabledPaymentRails, type PaymentRailSetting } from './accessControl';

export type PaymentNetworkKind = 'evm' | 'solana' | 'sui' | 'traditional' | 'unknown';
export type PaymentEnvironment = 'mainnet' | 'testnet' | 'devnet' | 'unknown';

export type ChivoPaymentRail = {
  id: string;
  railType: 'crypto' | 'traditional';
  provider: string;
  chain: string;
  networkKind: PaymentNetworkKind;
  environment: PaymentEnvironment;
  status: 'enabled' | 'disabled' | 'paused' | 'review';
  displayName: string;
  chainId: number | null;
  nativeSymbol: string | null;
  tokenSymbol: string | null;
  settlementAsset: string | null;
  contractAddress: string | null;
  contractKind: 'evm_contract' | 'solana_program' | 'sui_package' | null;
  explorerUrl: string | null;
  activeForCheckout: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
};

export type PaymentRailCatalog = {
  primaryRail: ChivoPaymentRail | null;
  enabledRails: ChivoPaymentRail[];
  futureRails: ChivoPaymentRail[];
  allRails: ChivoPaymentRail[];
};

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeNetworkKind(value: unknown, railType: ChivoPaymentRail['railType']): PaymentNetworkKind {
  if (value === 'evm' || value === 'solana' || value === 'sui' || value === 'traditional') {
    return value;
  }

  return railType === 'traditional' ? 'traditional' : 'unknown';
}

function normalizeEnvironment(value: unknown): PaymentEnvironment {
  if (value === 'mainnet' || value === 'testnet' || value === 'devnet') {
    return value;
  }

  return 'unknown';
}

export function normalizePaymentRail(rail: PaymentRailSetting): ChivoPaymentRail {
  const config = readObject(rail.config);
  const railType = rail.railType;

  return {
    id: rail.id,
    railType,
    provider: rail.provider,
    chain: rail.chain ?? readString(config.chain) ?? rail.provider,
    networkKind: normalizeNetworkKind(config.networkKind ?? config.network_kind, railType),
    environment: normalizeEnvironment(config.environment),
    status: rail.status,
    displayName: rail.displayName,
    chainId: readNumber(config.chainId ?? config.chain_id),
    nativeSymbol: readString(config.nativeSymbol ?? config.native_symbol),
    tokenSymbol: readString(config.tokenSymbol ?? config.token_symbol),
    settlementAsset: readString(config.settlementAsset ?? config.settlement_asset),
    contractAddress: readString(config.contractAddress ?? config.contract_address ?? config.routerAddress ?? config.router_address),
    contractKind:
      config.contractKind === 'evm_contract' ||
      config.contractKind === 'solana_program' ||
      config.contractKind === 'sui_package'
        ? config.contractKind
        : config.contract_kind === 'evm_contract' ||
            config.contract_kind === 'solana_program' ||
            config.contract_kind === 'sui_package'
          ? config.contract_kind
          : null,
    explorerUrl: readString(config.explorerUrl ?? config.explorer_url),
    activeForCheckout: readBoolean(config.activeForCheckout ?? config.active_for_checkout, rail.status === 'enabled'),
    sortOrder: readNumber(config.sortOrder ?? config.sort_order) ?? 1000,
    config,
  };
}

function normalizePaymentRailRow(row: Record<string, unknown>): PaymentRailSetting {
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

export async function fetchPaymentRailCatalog(): Promise<PaymentRailCatalog> {
  const allRails = await fetchAllPaymentRails();
  const enabledRails = allRails
    .filter((rail) => rail.status === 'enabled' && rail.activeForCheckout)
    .sort(sortRails);
  const futureRails = allRails
    .filter((rail) => rail.status !== 'enabled' || !rail.activeForCheckout)
    .sort(sortRails);

  return {
    primaryRail: enabledRails[0] ?? null,
    enabledRails,
    futureRails,
    allRails: allRails.sort(sortRails),
  };
}

export async function fetchCheckoutPaymentRails(): Promise<ChivoPaymentRail[]> {
  const rails = await fetchEnabledPaymentRails();

  return rails
    .map(normalizePaymentRail)
    .filter((rail) => rail.activeForCheckout)
    .sort(sortRails);
}

async function fetchAllPaymentRails(): Promise<ChivoPaymentRail[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('payment_rail_settings')
    .select('id, rail_type, provider, chain, status, display_name, config')
    .order('display_name', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === '42501' || error.code === 'PGRST205') {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => normalizePaymentRail(normalizePaymentRailRow(row)));
}

function sortRails(left: ChivoPaymentRail, right: ChivoPaymentRail) {
  return left.sortOrder - right.sortOrder || left.displayName.localeCompare(right.displayName);
}
