import { supabase } from '../lib/supabase';

export type SubscriptionRow = {
  id: string;
  school_id: string;
  plan_name: string;
  status: string;
  monthly_usd: number | string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentTransactionRow = {
  id: string;
  subscription_id: string;
  chain: 'solana' | 'base' | 'bnb';
  wallet_address: string;
  tx_hash: string;
  amount_usd: number | string;
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  paid_at: string | null;
  created_at: string;
};

export type SchoolBillingState = {
  subscription: SubscriptionRow | null;
  payments: PaymentTransactionRow[];
};

const emptyBilling: SchoolBillingState = {
  subscription: null,
  payments: [],
};

function client() {
  if (!supabase) {
    throw new Error('Billing is not available right now.');
  }

  return supabase;
}

export async function fetchSchoolBilling(schoolId: string): Promise<SchoolBillingState> {
  const db = client() as any;
  const { data: subscription, error: subscriptionError } = await db
    .from('subscriptions')
    .select('id, school_id, plan_name, status, monthly_usd, current_period_start, current_period_end, created_at, updated_at')
    .eq('school_id', schoolId)
    .maybeSingle();

  if (subscriptionError) {
    throw subscriptionError;
  }

  if (!subscription) {
    return emptyBilling;
  }

  const { data: payments, error: paymentsError } = await db
    .from('payment_transactions')
    .select('id, subscription_id, chain, wallet_address, tx_hash, amount_usd, status, paid_at, created_at')
    .eq('subscription_id', subscription.id)
    .order('created_at', { ascending: false });

  if (paymentsError) {
    throw paymentsError;
  }

  return {
    subscription: subscription as SubscriptionRow,
    payments: (payments ?? []) as PaymentTransactionRow[],
  };
}
