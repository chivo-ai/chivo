import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ethers } from 'https://esm.sh/ethers@6.13.4';

type PaymentIntent = {
  id: string;
  profile_id: string;
  entity_type: string;
  entity_id: string;
  chain: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

type AccessPolicy = {
  allowed?: boolean;
  reason?: string;
  paymentRequired?: boolean;
};

type OperatorRequest = {
  secret?: string;
  chain?: string;
  limit?: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const routerAbi = [
  'function releasePayment(bytes32 intentId) external',
  'function releasePayments(bytes32[] intentIds) external',
];

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as OperatorRequest;
    const expectedSecret = Deno.env.get('PAYOUT_OPERATOR_SECRET');

    if (!expectedSecret || body.secret !== expectedSecret) {
      return json({ error: 'Operator access is required.' }, 403);
    }

    const serviceRoleKey = getServiceRoleKey();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const privateKey = Deno.env.get('EVM_PAYOUT_OPERATOR_PRIVATE_KEY') ?? '';

    if (!serviceRoleKey || !supabaseUrl || !privateKey) {
      return json({ error: 'Payout operator is not configured.' }, 500);
    }

    const chain = String(body.chain ?? Deno.env.get('DEFAULT_EVM_PAYOUT_CHAIN') ?? 'polygon-mainnet');
    const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 80);
    const rpcUrl = getEvmRpcUrl(chain);

    if (!rpcUrl) {
      return json({ error: `No EVM RPC configured for ${chain}.` }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const { data: intents, error } = await supabase
      .from('onchain_payment_intents')
      .select('id, profile_id, entity_type, entity_id, chain, status, metadata')
      .eq('chain', chain)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const results = [];

    for (const intent of (intents ?? []) as PaymentIntent[]) {
      const metadata = intent.metadata ?? {};

      if (metadata.payoutStatus === 'released' || metadata.payoutStatus === 'refunded') {
        continue;
      }

      const routerAddress = await resolveRouterAddress(supabase, intent, metadata);
      const contractIntentId = String(metadata.contractIntentId ?? '');

      if (!routerAddress || !contractIntentId) {
        results.push(await markPayoutSkipped(supabase, intent, 'missing_contract_metadata'));
        continue;
      }

      const policy = await evaluatePolicy(supabase, intent);
      if (!policy.allowed) {
        results.push(await markPayoutWaiting(supabase, intent, policy.reason ?? 'policy_waiting'));
        continue;
      }

      const router = new ethers.Contract(routerAddress, routerAbi, signer);
      const tx = await router.releasePayment(contractIntentId);
      const receipt = await tx.wait(1);

      const nextMetadata = {
        ...metadata,
        payoutStatus: 'released',
        payoutReleasedAt: new Date().toISOString(),
        payoutTxHash: receipt?.hash ?? tx.hash,
        payoutOperator: await signer.getAddress(),
      };

      const { error: updateError } = await supabase
        .from('onchain_payment_intents')
        .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
        .eq('id', intent.id);

      if (updateError) {
        throw updateError;
      }

      results.push({ intentId: intent.id, status: 'released', txHash: receipt?.hash ?? tx.hash });
    }

    return json({ chain, processed: results.length, results });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Payout operator failed.' }, 500);
  }
});

async function evaluatePolicy(supabase: SupabaseClient, intent: PaymentIntent): Promise<AccessPolicy> {
  const { data, error } = await supabase.rpc('evaluate_access_policy', {
    target_entity_type: intent.entity_type,
    target_entity_id: intent.entity_id,
    target_profile_id: intent.profile_id,
  });

  if (error) {
    throw error;
  }

  return (data ?? { allowed: false, reason: 'policy_unavailable' }) as AccessPolicy;
}

async function markPayoutSkipped(supabase: SupabaseClient, intent: PaymentIntent, reason: string) {
  const nextMetadata = {
    ...(intent.metadata ?? {}),
    payoutStatus: 'blocked',
    payoutBlockedAt: new Date().toISOString(),
    payoutBlockedReason: reason,
  };

  const { error } = await supabase
    .from('onchain_payment_intents')
    .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq('id', intent.id);

  if (error) {
    throw error;
  }

  return { intentId: intent.id, status: 'blocked', reason };
}

async function markPayoutWaiting(supabase: SupabaseClient, intent: PaymentIntent, reason: string) {
  const nextMetadata = {
    ...(intent.metadata ?? {}),
    payoutStatus: 'waiting_policy',
    payoutWaitingAt: new Date().toISOString(),
    payoutWaitingReason: reason,
  };

  const { error } = await supabase
    .from('onchain_payment_intents')
    .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq('id', intent.id);

  if (error) {
    throw error;
  }

  return { intentId: intent.id, status: 'waiting_policy', reason };
}

function getEvmRpcUrl(chain: string) {
  const normalized = chain.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return Deno.env.get(`EVM_${normalized}_RPC_URL`) ?? Deno.env.get('EVM_RPC_URL') ?? '';
}

async function resolveRouterAddress(
  supabase: SupabaseClient,
  intent: PaymentIntent,
  metadata: Record<string, unknown>,
) {
  const metadataAddress = String(metadata.routerAddress ?? metadata.router_address ?? '').trim();

  if (metadataAddress) {
    return metadataAddress;
  }

  const chainOverride = intent.chain.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const envAddress =
    Deno.env.get(`EVM_${chainOverride}_PAYMENT_ROUTER_ADDRESS`) ??
    Deno.env.get('EVM_PAYMENT_ROUTER_ADDRESS') ??
    '';

  if (envAddress.trim()) {
    return envAddress.trim();
  }

  const { data, error } = await supabase
    .from('contract_program_registry')
    .select('address')
    .eq('chain', intent.chain)
    .eq('kind', 'evm_contract')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return String(data?.address ?? '').trim();
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
