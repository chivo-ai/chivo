import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ethers } from 'https://esm.sh/ethers@6.13.4';

type ListenerRequest = {
  secret?: string;
  chain?: string;
  limit?: number;
  lookbackBlocks?: number;
};

type PaymentIntent = {
  id: string;
  product_id: string | null;
  profile_id: string;
  entity_type: string;
  entity_id: string;
  chain: string;
  token_symbol: string;
  status: string;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
};

type AccessProduct = {
  id: string;
  billing_period: string;
  status: string;
};

type AccessPolicy = {
  allowed?: boolean;
  reason?: string;
  paymentRequired?: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const routerAbi = [
  'event PaymentDeposited(bytes32 indexed intentId, address indexed payer, address indexed recipient, address token, uint256 grossAmount, uint256 platformFee, uint256 netAmount, uint16 feeBps, uint64 expiresAt, uint64 releaseAfter)',
];

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ListenerRequest;
    const expectedSecret = Deno.env.get('PAYMENT_LISTENER_SECRET') ?? Deno.env.get('PAYOUT_OPERATOR_SECRET');

    if (!expectedSecret || body.secret !== expectedSecret) {
      return json({ error: 'Listener access is required.' }, 403);
    }

    const serviceRoleKey = getServiceRoleKey();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    if (!serviceRoleKey || !supabaseUrl) {
      return json({ error: 'Payment listener is not configured.' }, 500);
    }

    const chain = String(body.chain ?? Deno.env.get('DEFAULT_EVM_PAYOUT_CHAIN') ?? 'polygon-mainnet');
    const rpcUrl = getEvmRpcUrl(chain);

    if (!rpcUrl) {
      return json({ error: `No EVM RPC configured for ${chain}.` }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const latestBlock = await provider.getBlockNumber();
    const lookbackBlocks = Math.max(Number(body.lookbackBlocks ?? getChainNumberEnv(chain, 'LISTENER_LOOKBACK_BLOCKS') ?? 50_000), 1);
    const minConfirmations = Math.max(Number(getChainNumberEnv(chain, 'MIN_CONFIRMATIONS') ?? 64), 1);
    const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 80);

    const { data: intents, error } = await supabase
      .from('onchain_payment_intents')
      .select('id, product_id, profile_id, entity_type, entity_id, chain, token_symbol, status, expires_at, metadata')
      .eq('chain', chain)
      .in('status', ['awaiting_payment', 'observed'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const results = [];

    for (const intent of (intents ?? []) as PaymentIntent[]) {
      const metadata = readObject(intent.metadata);
      const expired = intent.expires_at ? new Date(intent.expires_at).getTime() < Date.now() : false;

      if (expired) {
        results.push(await markIntentExpired(supabase, intent));
        continue;
      }

      const result = await observeIntent(supabase, provider, intent, metadata, latestBlock, lookbackBlocks, minConfirmations);
      if (result) {
        results.push(result);
      }
    }

    return json({ chain, latestBlock, minConfirmations, processed: results.length, results });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Payment listener failed.' }, 500);
  }
});

async function observeIntent(
  supabase: SupabaseClient,
  provider: ethers.JsonRpcProvider,
  intent: PaymentIntent,
  metadata: Record<string, unknown>,
  latestBlock: number,
  lookbackBlocks: number,
  minConfirmations: number,
) {
  const contractIntentId = readString(metadata.contractIntentId ?? metadata.contract_intent_id);
  const routerAddress = readString(metadata.routerAddress ?? metadata.router_address);

  if (!contractIntentId || !routerAddress) {
    return markIntentBlocked(supabase, intent, 'missing_contract_metadata');
  }

  const router = new ethers.Contract(routerAddress, routerAbi, provider);
  const fromBlock = Math.max(
    readNumber(metadata.listenerFromBlock ?? metadata.listener_from_block) ?? latestBlock - lookbackBlocks,
    0,
  );
  const logs = await router.queryFilter(router.filters.PaymentDeposited(contractIntentId), fromBlock, latestBlock);

  if (!logs.length) {
    return null;
  }

  const event = logs[0] as ethers.EventLog;
  const args = event.args;
  const validationError = validateDepositEvent(intent, metadata, args);

  if (validationError) {
    await recordPaymentEvent(supabase, intent, metadata, event, args, latestBlock, 'rejected', validationError);
    return markIntentRejected(supabase, intent, validationError);
  }

  const confirmations = Math.max(latestBlock - event.blockNumber + 1, 0);
  const confirmed = confirmations >= minConfirmations;
  const eventStatus = confirmed ? 'confirmed' : 'observed';
  await recordPaymentEvent(supabase, intent, metadata, event, args, latestBlock, eventStatus);

  if (!confirmed) {
    return updateIntentMetadata(supabase, intent, {
      ...metadata,
      paymentStatus: 'observed',
      observedTxHash: event.transactionHash,
      observedBlockNumber: event.blockNumber,
      confirmations,
    }, 'observed');
  }

  const grantResult = await grantAccessIfAllowed(supabase, intent, metadata, event.transactionHash);
  return updateIntentMetadata(supabase, intent, {
    ...metadata,
    paymentStatus: 'confirmed',
    confirmedTxHash: event.transactionHash,
    confirmedBlockNumber: event.blockNumber,
    confirmations,
    ...grantResult.metadata,
  }, 'confirmed');
}

function validateDepositEvent(
  intent: PaymentIntent,
  metadata: Record<string, unknown>,
  args: ethers.Result,
) {
  const expectedPayer = readString(metadata.payerAddress ?? metadata.payer_address);
  const expectedRecipient = readString(metadata.recipient);
  const expectedToken = readString(metadata.tokenAddress ?? metadata.token_address) ?? ethers.ZeroAddress;
  const expectedAmount = readString(metadata.amountWei ?? metadata.amount_wei);
  const expectedFeeBps = readNumber(metadata.feeBps ?? metadata.fee_bps);
  const expectedExpiresAt = readNumber(metadata.expiresAt ?? metadata.expires_at);
  const expectedReleaseAfter = readNumber(metadata.releaseAfter ?? metadata.release_after);

  if (expectedPayer && !sameAddress(args.payer, expectedPayer)) {
    return 'payer_mismatch';
  }

  if (expectedRecipient && !sameAddress(args.recipient, expectedRecipient)) {
    return 'recipient_mismatch';
  }

  if (!sameAddress(args.token, expectedToken)) {
    return 'token_mismatch';
  }

  if (expectedAmount && args.grossAmount.toString() !== expectedAmount) {
    return 'amount_mismatch';
  }

  if (expectedFeeBps !== null && Number(args.feeBps) !== expectedFeeBps) {
    return 'fee_mismatch';
  }

  if (expectedExpiresAt !== null && Number(args.expiresAt) !== expectedExpiresAt) {
    return 'expiry_mismatch';
  }

  if (expectedReleaseAfter !== null && Number(args.releaseAfter) !== expectedReleaseAfter) {
    return 'release_after_mismatch';
  }

  if (intent.expires_at && new Date(intent.expires_at).getTime() < Date.now()) {
    return 'intent_expired';
  }

  return null;
}

async function recordPaymentEvent(
  supabase: SupabaseClient,
  intent: PaymentIntent,
  metadata: Record<string, unknown>,
  event: ethers.EventLog,
  args: ethers.Result,
  latestBlock: number,
  status: 'observed' | 'confirmed' | 'rejected',
  rejectionReason?: string,
) {
  const decimals = readNumber(metadata.tokenDecimals ?? metadata.token_decimals) ?? 18;
  const confirmations = Math.max(latestBlock - event.blockNumber + 1, 0);

  const { error } = await supabase
    .from('onchain_payment_events')
    .upsert({
      intent_id: intent.id,
      chain: intent.chain,
      tx_hash: event.transactionHash,
      payer_address: String(args.payer),
      receiver_address: String(args.recipient),
      amount: ethers.formatUnits(args.grossAmount, decimals),
      token_symbol: intent.token_symbol,
      block_number: event.blockNumber,
      confirmations,
      finality_status: status,
      status,
      rejection_reason: rejectionReason ?? null,
      raw_event: {
        contractIntentId: String(args.intentId),
        token: String(args.token),
        grossAmount: args.grossAmount.toString(),
        platformFee: args.platformFee.toString(),
        netAmount: args.netAmount.toString(),
        feeBps: Number(args.feeBps),
        expiresAt: Number(args.expiresAt),
        releaseAfter: Number(args.releaseAfter),
        logIndex: event.index,
      },
      observed_at: new Date().toISOString(),
    }, { onConflict: 'chain,tx_hash' });

  if (error) {
    throw error;
  }
}

async function grantAccessIfAllowed(
  supabase: SupabaseClient,
  intent: PaymentIntent,
  metadata: Record<string, unknown>,
  txHash: string,
) {
  const policy = await evaluatePolicy(supabase, intent);

  if (policy.allowed && !policy.paymentRequired) {
    return {
      metadata: {
        accessGrantStatus: 'already_allowed',
        accessGrantReason: policy.reason ?? null,
      },
    };
  }

  if (!policy.allowed && policy.reason !== 'payment_required') {
    return {
      metadata: {
        accessGrantStatus: 'blocked',
        accessGrantReason: policy.reason ?? 'policy_blocked',
      },
    };
  }

  if (!['school', 'class', 'crew', 'subject', 'publication'].includes(intent.entity_type)) {
    return {
      metadata: {
        accessGrantStatus: 'not_applicable',
        accessGrantReason: 'entity_does_not_use_access_pass',
      },
    };
  }

  const existingPass = await fetchExistingAccessPass(supabase, intent);
  if (existingPass) {
    return {
      metadata: {
        accessGrantStatus: 'existing_pass',
        accessPassId: existingPass.id,
      },
    };
  }

  const product = intent.product_id ? await fetchProduct(supabase, intent.product_id) : null;
  const endsAt = product ? calculateAccessEndsAt(product.billing_period) : null;

  const { data, error } = await supabase
    .from('access_passes')
    .insert({
      product_id: intent.product_id,
      profile_id: intent.profile_id,
      entity_type: intent.entity_type,
      entity_id: intent.entity_id,
      source: 'paid',
      status: 'active',
      ends_at: endsAt,
      metadata: {
        paymentIntentId: intent.id,
        paymentTxHash: txHash,
        chain: intent.chain,
        contractIntentId: metadata.contractIntentId ?? metadata.contract_intent_id ?? null,
      },
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return {
    metadata: {
      accessGrantStatus: 'granted',
      accessPassId: data.id,
    },
  };
}

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

async function fetchExistingAccessPass(supabase: SupabaseClient, intent: PaymentIntent) {
  const { data, error } = await supabase
    .from('access_passes')
    .select('id')
    .eq('profile_id', intent.profile_id)
    .eq('entity_type', intent.entity_type)
    .eq('entity_id', intent.entity_id)
    .eq('status', 'active')
    .lte('starts_at', new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: string } | null;
}

async function fetchProduct(supabase: SupabaseClient, productId: string): Promise<AccessProduct | null> {
  const { data, error } = await supabase
    .from('access_products')
    .select('id, billing_period, status')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AccessProduct | null;
}

async function markIntentExpired(supabase: SupabaseClient, intent: PaymentIntent) {
  return updateIntentMetadata(supabase, intent, {
    ...readObject(intent.metadata),
    paymentStatus: 'expired',
    expiredAt: new Date().toISOString(),
  }, 'expired');
}

async function markIntentRejected(supabase: SupabaseClient, intent: PaymentIntent, reason: string) {
  return updateIntentMetadata(supabase, intent, {
    ...readObject(intent.metadata),
    paymentStatus: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectionReason: reason,
  }, 'rejected');
}

async function markIntentBlocked(supabase: SupabaseClient, intent: PaymentIntent, reason: string) {
  return updateIntentMetadata(supabase, intent, {
    ...readObject(intent.metadata),
    paymentStatus: 'blocked',
    blockedAt: new Date().toISOString(),
    blockedReason: reason,
  }, 'rejected');
}

async function updateIntentMetadata(
  supabase: SupabaseClient,
  intent: PaymentIntent,
  metadata: Record<string, unknown>,
  status: 'observed' | 'confirmed' | 'rejected' | 'expired',
) {
  const { error } = await supabase
    .from('onchain_payment_intents')
    .update({
      status,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intent.id);

  if (error) {
    throw error;
  }

  return { intentId: intent.id, status, metadata };
}

function calculateAccessEndsAt(billingPeriod: string) {
  const now = new Date();

  if (billingPeriod === 'weekly') {
    now.setUTCDate(now.getUTCDate() + 7);
    return now.toISOString();
  }

  if (billingPeriod === 'monthly') {
    now.setUTCMonth(now.getUTCMonth() + 1);
    return now.toISOString();
  }

  if (billingPeriod === 'yearly') {
    now.setUTCFullYear(now.getUTCFullYear() + 1);
    return now.toISOString();
  }

  return null;
}

function getEvmRpcUrl(chain: string) {
  const normalized = chain.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return Deno.env.get(`EVM_${normalized}_RPC_URL`) ?? Deno.env.get('EVM_RPC_URL') ?? '';
}

function getChainNumberEnv(chain: string, suffix: string) {
  const normalized = chain.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return readNumber(Deno.env.get(`EVM_${normalized}_${suffix}`) ?? Deno.env.get(`EVM_${suffix}`));
}

function sameAddress(left: unknown, right: unknown) {
  try {
    return ethers.getAddress(String(left)) === ethers.getAddress(String(right));
  } catch {
    return false;
  }
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
