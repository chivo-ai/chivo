import { supabase } from '../lib/supabase';
import { ChivoPaymentRail } from './paymentRails';

export type CheckoutEntityType = 'school' | 'class' | 'crew' | 'subject' | 'verification' | 'donation' | 'publication';

export type AccessCheckoutRequest = {
  productId?: string;
  entityType?: CheckoutEntityType;
  entityId?: string;
  paymentRailId?: string;
  railChain?: string;
  payerAddress?: string;
};

export type EvmCheckoutInstructions = {
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

export type AccessCheckoutResponse = {
  paymentRequired: boolean;
  productId?: string;
  accessPolicy?: Record<string, unknown>;
  rail?: Pick<ChivoPaymentRail, 'id' | 'railType' | 'provider' | 'chain' | 'displayName' | 'networkKind' | 'environment'>;
  intent?: {
    id: string;
    status: string;
    expiresAt: string;
    contractIntentId: string;
  };
  evm?: EvmCheckoutInstructions;
};

export async function createAccessCheckout(request: AccessCheckoutRequest): Promise<AccessCheckoutResponse> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await (supabase as any).functions.invoke('create-access-checkout', {
    body: request,
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data as AccessCheckoutResponse;
}
