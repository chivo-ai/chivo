import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ethers } from 'https://esm.sh/ethers@6.13.4';

type CheckoutPurpose = 'donation' | 'funding_campaign';

type CheckoutRequest = {
  purpose?: CheckoutPurpose;
  targetId?: string;
  amount?: string | number;
  paymentRailId?: string;
  railChain?: string;
  payerAddress?: string;
  contributorAddress?: string;
  recognitionTier?: string;
};

type PaymentRail = {
  id: string;
  rail_type: 'crypto' | 'traditional';
  provider: string;
  chain: string | null;
  status: 'enabled' | 'disabled' | 'paused' | 'review';
  display_name: string;
  config: Record<string, unknown> | null;
};

type MonetizationTarget = {
  entityType: 'donation' | 'funding_campaign';
  entityId: string;
  recipientAddress: string;
  recipientProfileId: string | null;
  schoolId: string | null;
  feeBps: number;
  currency: string | null;
  metadata: Record<string, unknown>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const eip712Types = {
  PaymentAuthorization: [
    { name: 'intentId', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'feeBps', type: 'uint16' },
    { name: 'expiresAt', type: 'uint64' },
    { name: 'releaseAfter', type: 'uint64' },
  ],
};

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
      return json({ error: 'Monetization checkout is not configured.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session.' }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
    if (!body.purpose || !body.targetId) {
      return json({ error: 'Checkout purpose and target are required.' }, 400);
    }

    if (body.purpose !== 'donation' && body.purpose !== 'funding_campaign') {
      return json({ error: 'Unsupported monetization checkout purpose.' }, 400);
    }

    const rail = await fetchCheckoutRail(supabase, body);
    if (!rail) {
      return json({ error: 'No enabled checkout rail is available.' }, 404);
    }

    const railConfig = readObject(rail.config);
    const networkKind = readString(railConfig.network_kind ?? railConfig.networkKind);

    if (networkKind !== 'evm') {
      return json({
        error: `${rail.display_name} checkout is not wired yet.`,
        nextAdapter: networkKind ?? 'unknown',
      }, 400);
    }

    const target = await fetchTarget(supabase, body.purpose, body.targetId, rail);
    if (!target) {
      return json({ error: 'Monetization target was not found or is not active.' }, 404);
    }

    const amountInput = String(body.amount ?? '').trim();
    if (!amountInput) {
      return json({ error: 'Amount is required.' }, 400);
    }

    return json(await createEvmCheckout(supabase, user.id, target, rail, railConfig, amountInput, body));
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Monetization checkout could not be created.' }, 500);
  }
});

async function createEvmCheckout(
  supabase: SupabaseClient,
  profileId: string,
  target: MonetizationTarget,
  rail: PaymentRail,
  railConfig: Record<string, unknown>,
  amountInput: string,
  body: CheckoutRequest,
) {
  const privateKey = Deno.env.get('EVM_AUTHORIZER_PRIVATE_KEY') ?? Deno.env.get('CHIVO_EVM_AUTHORIZER_PRIVATE_KEY') ?? '';

  if (!privateKey) {
    throw new Error('EVM checkout authorizer is not configured.');
  }

  const chain = readString(rail.chain) ?? readString(railConfig.chain) ?? '';
  const chainId = readNumber(railConfig.chain_id ?? railConfig.chainId);
  const routerAddress = await resolveRouterAddress(supabase, chain, railConfig);
  const payerAddress = normalizeAddress(body.payerAddress, 'payer address');
  const tokenAddress = normalizeAddress(
    readString(railConfig.token_address ?? railConfig.tokenAddress) ?? ethers.ZeroAddress,
    'token address',
  );
  const tokenSymbol =
    readString(railConfig.token_symbol ?? railConfig.tokenSymbol) ??
    readString(railConfig.settlement_asset ?? railConfig.settlementAsset) ??
    readString(railConfig.native_symbol ?? railConfig.nativeSymbol) ??
    target.currency ??
    'POL';
  const decimals = readNumber(railConfig.token_decimals ?? railConfig.tokenDecimals ?? railConfig.decimals) ?? 18;
  const feeBps = target.feeBps;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (readNumber(railConfig.checkout_expiry_seconds ?? railConfig.checkoutExpirySeconds) ?? 1800);
  const releaseAfter = now + (readNumber(railConfig.min_release_delay_seconds ?? railConfig.minReleaseDelaySeconds) ?? 0);
  const amountWei = parseCheckoutAmount(amountInput, decimals);
  const amount = ethers.formatUnits(amountWei, decimals);

  if (!chain || !chainId || !routerAddress) {
    throw new Error('Selected EVM payment rail is missing chain, chain id, or router address.');
  }

  if (feeBps < 0 || feeBps > 2500) {
    throw new Error('Selected target has an invalid platform fee.');
  }

  const contractIntentId = ethers.hexlify(ethers.randomBytes(32));
  const signer = new ethers.Wallet(privateKey);
  const authorization = await signer.signTypedData(
    {
      name: 'ChivoPaymentRouter',
      version: '1',
      chainId,
      verifyingContract: routerAddress,
    },
    eip712Types,
    {
      intentId: contractIntentId,
      payer: payerAddress,
      recipient: target.recipientAddress,
      token: tokenAddress,
      amount: amountWei,
      feeBps,
      expiresAt,
      releaseAfter,
    },
  );

  const metadata = {
    checkoutVersion: 1,
    checkoutPurpose: target.entityType,
    networkKind: 'evm',
    paymentRailId: rail.id,
    provider: rail.provider,
    routerAddress,
    chainId,
    tokenAddress,
    tokenDecimals: decimals,
    amountWei: amountWei.toString(),
    contractIntentId,
    authorization,
    expiresAt,
    releaseAfter,
    feeBps,
    recipient: target.recipientAddress,
    payerAddress,
    authorizer: await signer.getAddress(),
    targetMetadata: target.metadata,
  };

  const { data: intent, error } = await supabase
    .from('onchain_payment_intents')
    .insert({
      product_id: null,
      profile_id: profileId,
      entity_type: target.entityType,
      entity_id: target.entityId,
      chain,
      token_symbol: tokenSymbol,
      expected_amount: amount,
      expected_receiver: target.recipientAddress,
      payer_address: payerAddress,
      status: 'awaiting_payment',
      expires_at: new Date(expiresAt * 1000).toISOString(),
      metadata,
    })
    .select('id, status, expires_at')
    .single();

  if (error) {
    throw error;
  }

  if (target.entityType === 'funding_campaign') {
    await createFundingContribution(supabase, target.entityId, profileId, intent.id, chain, body, amount, tokenSymbol);
  }

  return {
    paymentRequired: true,
    purpose: target.entityType,
    targetId: target.entityId,
    rail: {
      id: rail.id,
      provider: rail.provider,
      chain: rail.chain,
      displayName: rail.display_name,
    },
    intent: {
      id: intent.id,
      status: intent.status,
      expiresAt: intent.expires_at,
      contractIntentId,
    },
    evm: {
      chain,
      chainId,
      routerAddress,
      depositMethod: tokenAddress === ethers.ZeroAddress ? 'depositNative' : 'depositToken',
      payerAddress,
      recipient: target.recipientAddress,
      tokenAddress,
      tokenSymbol,
      amount,
      amountWei: amountWei.toString(),
      feeBps,
      expiresAt,
      releaseAfter,
      authorization,
    },
  };
}

async function fetchTarget(
  supabase: SupabaseClient,
  purpose: CheckoutPurpose,
  targetId: string,
  rail: PaymentRail,
): Promise<MonetizationTarget | null> {
  if (purpose === 'donation') {
    const { data, error } = await supabase
      .from('donation_targets')
      .select('id, entity_type, entity_id, recipient_profile_id, school_id, status, fee_bps, accepted_rails, metadata')
      .eq('id', targetId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || !targetAllowsRail(data.accepted_rails, rail)) {
      return null;
    }

    const metadata = readObject(data.metadata);
    const recipient = resolveRecipient(metadata, rail);

    return {
      entityType: 'donation',
      entityId: data.id,
      recipientAddress: recipient,
      recipientProfileId: data.recipient_profile_id,
      schoolId: data.school_id,
      feeBps: Number(data.fee_bps ?? 50),
      currency: readString(metadata.currency),
      metadata: {
        sourceEntityType: data.entity_type,
        sourceEntityId: data.entity_id,
      },
    };
  }

  const { data, error } = await supabase
    .from('funding_campaigns')
    .select('id, creator_profile_id, school_id, goal_amount, currency, preferred_chain, fee_bps, status, metadata')
    .eq('id', targetId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (data.preferred_chain && data.preferred_chain !== rail.chain) {
    return null;
  }

  const metadata = readObject(data.metadata);
  const recipient = resolveRecipient(metadata, rail);

  return {
    entityType: 'funding_campaign',
    entityId: data.id,
    recipientAddress: recipient,
    recipientProfileId: data.creator_profile_id,
    schoolId: data.school_id,
    feeBps: Number(data.fee_bps ?? 50),
    currency: data.currency,
    metadata: {
      goalAmount: data.goal_amount,
    },
  };
}

async function createFundingContribution(
  supabase: SupabaseClient,
  campaignId: string,
  profileId: string,
  paymentIntentId: string,
  chain: string,
  body: CheckoutRequest,
  amount: string,
  tokenSymbol: string,
) {
  const { error } = await supabase
    .from('funding_contributions')
    .insert({
      campaign_id: campaignId,
      contributor_profile_id: profileId,
      payment_intent_id: paymentIntentId,
      chain,
      contributor_address: body.contributorAddress ?? body.payerAddress ?? null,
      amount,
      currency: tokenSymbol,
      recognition_tier: body.recognitionTier ?? null,
      status: 'pending',
    });

  if (error) {
    throw error;
  }
}

async function fetchCheckoutRail(supabase: SupabaseClient, body: CheckoutRequest): Promise<PaymentRail | null> {
  let query = supabase
    .from('payment_rail_settings')
    .select('id, rail_type, provider, chain, status, display_name, config')
    .eq('status', 'enabled');

  if (body.paymentRailId) {
    query = query.eq('id', body.paymentRailId);
  }

  if (body.railChain) {
    query = query.eq('chain', body.railChain);
  }

  const { data, error } = await query.order('display_name', { ascending: true });

  if (error) {
    throw error;
  }

  const rails = ((data ?? []) as PaymentRail[]).filter((rail) => {
    const config = readObject(rail.config);
    return readBoolean(config.active_for_checkout ?? config.activeForCheckout, rail.status === 'enabled');
  });

  return rails.sort(sortRails)[0] ?? null;
}

async function resolveRouterAddress(
  supabase: SupabaseClient,
  chain: string,
  railConfig: Record<string, unknown>,
) {
  const configAddress = readString(
    railConfig.router_address ??
      railConfig.routerAddress ??
      railConfig.contract_address ??
      railConfig.contractAddress,
  );

  if (configAddress) {
    return normalizeAddress(configAddress, 'router address');
  }

  const chainOverride = chain.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const envAddress =
    Deno.env.get(`EVM_${chainOverride}_PAYMENT_ROUTER_ADDRESS`) ??
    Deno.env.get('EVM_PAYMENT_ROUTER_ADDRESS') ??
    '';

  if (envAddress.trim()) {
    return normalizeAddress(envAddress, 'router address');
  }

  const { data, error } = await supabase
    .from('contract_program_registry')
    .select('address')
    .eq('chain', chain)
    .eq('kind', 'evm_contract')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const registryAddress = readString(data?.address);
  return registryAddress ? normalizeAddress(registryAddress, 'router address') : null;
}

function targetAllowsRail(acceptedRails: unknown, rail: PaymentRail) {
  if (!Array.isArray(acceptedRails) || acceptedRails.length === 0) {
    return true;
  }

  return acceptedRails.some((entry) => {
    if (typeof entry === 'string') {
      return [rail.id, rail.chain, rail.provider].includes(entry);
    }

    const value = readObject(entry);
    return [value.id, value.chain, value.provider].some((candidate) =>
      candidate === rail.id || candidate === rail.chain || candidate === rail.provider,
    );
  });
}

function resolveRecipient(metadata: Record<string, unknown>, rail: PaymentRail) {
  const chain = readString(rail.chain) ?? '';
  const recipient =
    readRailString(metadata, chain, 'evm_recipient_address') ??
    readRailString(metadata, chain, 'recipient_address') ??
    readRailString(metadata, chain, 'payout_address') ??
    readString(metadata.evm_recipient_address ?? metadata.evmRecipientAddress) ??
    readString(metadata.recipient_address ?? metadata.recipientAddress) ??
    readString(metadata.payout_address ?? metadata.payoutAddress) ??
    Deno.env.get('CHIVO_DEFAULT_EVM_RECIPIENT_ADDRESS') ??
    '';

  return normalizeAddress(recipient, 'recipient address');
}

function readRailString(metadata: Record<string, unknown>, chain: string, key: string) {
  const railMaps = [
    readObject(metadata.payout_recipients ?? metadata.payoutRecipients),
    readObject(metadata.rail_recipients ?? metadata.railRecipients),
  ];

  for (const map of railMaps) {
    const chainValue = readObject(map[chain]);
    const value = readString(chainValue[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function parseCheckoutAmount(amountInput: string, decimals: number) {
  const amount = ethers.parseUnits(amountInput, decimals);

  if (amount <= 0n) {
    throw new Error('Checkout amount must be greater than zero.');
  }

  return amount;
}

function sortRails(left: PaymentRail, right: PaymentRail) {
  const leftOrder = readNumber(readObject(left.config).sort_order ?? readObject(left.config).sortOrder) ?? 1000;
  const rightOrder = readNumber(readObject(right.config).sort_order ?? readObject(right.config).sortOrder) ?? 1000;

  return leftOrder - rightOrder || left.display_name.localeCompare(right.display_name);
}

function normalizeAddress(value: unknown, label: string) {
  const address = readString(value);

  if (!address) {
    throw new Error(`Missing ${label}.`);
  }

  try {
    return ethers.getAddress(address);
  } catch {
    throw new Error(`Invalid ${label}.`);
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

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
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
