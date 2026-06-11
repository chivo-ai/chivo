import { supabase } from '../lib/supabase';

export type MonetizationCheckoutPurpose = 'donation' | 'funding_campaign';

export type MonetizationCheckoutRequest = {
  purpose: MonetizationCheckoutPurpose;
  targetId: string;
  amount: string | number;
  paymentRailId?: string;
  railChain?: string;
  payerAddress: string;
  contributorAddress?: string;
  recognitionTier?: string;
};

export type MonetizationEvmCheckoutInstructions = {
  chain: string;
  chainId: number;
  routerAddress: string;
  depositMethod: 'depositNative' | 'depositToken';
  payerAddress: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  amountWei: string;
  feeBps: number;
  expiresAt: number;
  releaseAfter: number;
  authorization: string;
};

export type MonetizationCheckoutResponse = {
  paymentRequired: boolean;
  purpose: MonetizationCheckoutPurpose;
  targetId: string;
  rail?: {
    id: string;
    provider: string;
    chain: string | null;
    displayName: string;
  };
  intent?: {
    id: string;
    status: string;
    expiresAt: string;
    contractIntentId: string;
  };
  evm?: MonetizationEvmCheckoutInstructions;
};

export async function createMonetizationCheckout(
  request: MonetizationCheckoutRequest,
): Promise<MonetizationCheckoutResponse> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await (supabase as any).functions.invoke('create-monetization-checkout', {
    body: request,
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data as MonetizationCheckoutResponse;
}
