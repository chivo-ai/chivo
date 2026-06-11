import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ethers } from 'https://esm.sh/ethers@6.13.4';

type AccessEntityType = 'school' | 'class' | 'crew' | 'subject' | 'verification' | 'donation' | 'publication';

type CheckoutRequest = {
  productId?: string;
  entityType?: AccessEntityType;
  entityId?: string;
  paymentRailId?: string;
  railChain?: string;
  payerAddress?: string;
};

type AccessProduct = {
  id: string;
  school_id: string | null;
  entity_type: AccessEntityType;
  entity_id: string | null;
  name: string;
  access_mode: 'free' | 'paid' | 'disabled';
  billing_period: string;
  amount: string | number;
  currency: string;
  payment_rails: unknown;
  status: string;
  metadata: Record<string, unknown> | null;
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

type AccessPolicy = {
  allowed?: boolean;
  reason?: string;
  paymentRequired?: boolean;
  productId?: string | null;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = getServiceRoleKey();

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Checkout is not configured.' }, 500);
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
    let product = body.productId ? await fetchProductById(supabase, body.productId) : null;

    const entityType = body.entityType ?? product?.entity_type;
    const entityId = body.entityId ?? product?.entity_id;

    if (!entityType || !entityId) {
      return json({ error: 'A product or target entity is required.' }, 400);
    }

    const accessPolicy = await evaluatePolicy(supabase, entityType, entityId, user.id);

    if (accessPolicy.allowed && !accessPolicy.paymentRequired) {
      return json({
        paymentRequired: false,
        accessPolicy,
      });
    }

    if (!accessPolicy.paymentRequired && !accessPolicy.allowed) {
      return json({
        error: 'Access is not available for this target.',
        accessPolicy,
      }, 403);
    }

    if (!product && accessPolicy.productId) {
      product = await fetchProductById(supabase, accessPolicy.productId);
    }

    if (!product) {
      product = await fetchProductByEntity(supabase, entityType, entityId);
    }

    if (!product) {
      return json({ error: 'No active access product was found.' }, 404);
    }

    if (product.entity_type !== entityType || product.entity_id !== entityId) {
      return json({ error: 'Product does not match the requested target.' }, 400);
    }

    if (product.access_mode === 'disabled') {
      return json({ error: 'This product is not accepting access right now.' }, 403);
    }

    if (product.access_mode !== 'paid') {
      return json({ paymentRequired: false, productId: product.id, accessPolicy });
    }

    const rail = await fetchCheckoutRail(supabase, body);
    if (!rail) {
      return json({ error: 'No enabled checkout rail is available.' }, 404);
    }

    if (!productAllowsRail(product.payment_rails, rail)) {
      return json({ error: 'This product does not accept the selected payment rail.' }, 400);
    }

    const railConfig = readObject(rail.config);
    const networkKind = readString(railConfig.network_kind ?? railConfig.networkKind);

    if (networkKind !== 'evm') {
      return json({
        error: `${rail.display_name} checkout is not wired yet.`,
        rail: summarizeRail(rail),
        nextAdapter: networkKind ?? 'unknown',
      }, 400);
    }

    return json(await createEvmCheckout(supabase, user.id, product, rail, railConfig, body));
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Checkout could not be created.' }, 500);
  }
});

async function createEvmCheckout(
  supabase: SupabaseClient,
  profileId: string,
  product: AccessProduct,
  rail: PaymentRail,
  railConfig: Record<string, unknown>,
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
  const recipient = resolveRecipient(product, rail, railConfig);
  const tokenAddress = normalizeAddress(
    readString(railConfig.token_address ?? railConfig.tokenAddress) ?? ethers.ZeroAddress,
    'token address',
  );
  const tokenSymbol =
    readString(railConfig.token_symbol ?? railConfig.tokenSymbol) ??
    readString(railConfig.settlement_asset ?? railConfig.settlementAsset) ??
    readString(railConfig.native_symbol ?? railConfig.nativeSymbol) ??
    'POL';
  const decimals = readNumber(railConfig.token_decimals ?? railConfig.tokenDecimals ?? railConfig.decimals) ?? 18;
  const platformFeeBps = await fetchPlatformFeeBps(supabase);
  const feeBps = readNumber(railConfig.fee_bps ?? railConfig.feeBps) ?? platformFeeBps;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (readNumber(railConfig.checkout_expiry_seconds ?? railConfig.checkoutExpirySeconds) ?? 1800);
  const releaseAfter = now + (readNumber(railConfig.min_release_delay_seconds ?? railConfig.minReleaseDelaySeconds) ?? 0);
  const amountWei = resolveAmountWei(product, rail, railConfig, tokenSymbol, decimals);
  const amount = ethers.formatUnits(amountWei, decimals);

  if (!chain || !chainId || !routerAddress) {
    throw new Error('Selected EVM payment rail is missing chain, chain id, or router address.');
  }

  if (feeBps < 0 || feeBps > 2500) {
    throw new Error('Selected EVM payment rail has an invalid platform fee.');
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
      recipient,
      token: tokenAddress,
      amount: amountWei,
      feeBps,
      expiresAt,
      releaseAfter,
    },
  );

  const metadata = {
    checkoutVersion: 1,
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
    recipient,
    payerAddress,
    authorizer: await signer.getAddress(),
  };

  const { data: intent, error } = await supabase
    .from('onchain_payment_intents')
    .insert({
      product_id: product.id,
      profile_id: profileId,
      entity_type: product.entity_type,
      entity_id: product.entity_id,
      chain,
      token_symbol: tokenSymbol,
      expected_amount: amount,
      expected_receiver: recipient,
      payer_address: payerAddress,
      status: 'awaiting_payment',
      expires_at: new Date(expiresAt * 1000).toISOString(),
      metadata,
    })
    .select('id, status, expires_at, metadata')
    .single();

  if (error) {
    throw error;
  }

  return {
    paymentRequired: true,
    productId: product.id,
    rail: summarizeRail(rail),
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
      recipient,
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

async function evaluatePolicy(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  profileId: string,
): Promise<AccessPolicy> {
  const { data, error } = await supabase.rpc('evaluate_access_policy', {
    target_entity_type: entityType,
    target_entity_id: entityId,
    target_profile_id: profileId,
  });

  if (error) {
    throw error;
  }

  return (data ?? { allowed: false, reason: 'policy_unavailable' }) as AccessPolicy;
}

async function fetchProductById(supabase: SupabaseClient, productId: string): Promise<AccessProduct | null> {
  const { data, error } = await supabase
    .from('access_products')
    .select('id, school_id, entity_type, entity_id, name, access_mode, billing_period, amount, currency, payment_rails, status, metadata')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AccessProduct | null;
}

async function fetchProductByEntity(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
): Promise<AccessProduct | null> {
  const { data, error } = await supabase
    .from('access_products')
    .select('id, school_id, entity_type, entity_id, name, access_mode, billing_period, amount, currency, payment_rails, status, metadata')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AccessProduct | null;
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

async function fetchPlatformFeeBps(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'billing_control')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return readNumber(readObject(data?.value).platform_fee_bps) ?? 50;
}

function resolveAmountWei(
  product: AccessProduct,
  rail: PaymentRail,
  railConfig: Record<string, unknown>,
  tokenSymbol: string,
  decimals: number,
) {
  const metadata = readObject(product.metadata);
  const chain = readString(rail.chain) ?? '';
  const explicitAmount =
    readRailString(metadata, chain, 'amount_wei') ??
    readRailString(metadata, chain, 'amountWei') ??
    readString(metadata.amount_wei ?? metadata.amountWei);

  if (explicitAmount) {
    if (!/^\d+$/.test(explicitAmount)) {
      throw new Error(`Product metadata amount_wei for ${chain} must be an integer string.`);
    }

    const amount = BigInt(explicitAmount);
    if (amount <= 0n) {
      throw new Error('Checkout amount must be greater than zero.');
    }

    return amount;
  }

  const currency = product.currency.trim().toUpperCase();
  const allowedSymbols = [
    tokenSymbol,
    readString(railConfig.settlement_asset ?? railConfig.settlementAsset),
    readString(railConfig.native_symbol ?? railConfig.nativeSymbol),
  ]
    .filter(Boolean)
    .map((symbol) => String(symbol).trim().toUpperCase());

  if (!allowedSymbols.includes(currency)) {
    throw new Error(
      `Product ${product.id} needs metadata.payment_amounts.${chain}.amount_wei before it can use ${rail.display_name}.`,
    );
  }

  const amount = ethers.parseUnits(String(product.amount), decimals);
  if (amount <= 0n) {
    throw new Error('Checkout amount must be greater than zero.');
  }

  return amount;
}

function resolveRecipient(
  product: AccessProduct,
  rail: PaymentRail,
  railConfig: Record<string, unknown>,
) {
  const metadata = readObject(product.metadata);
  const chain = readString(rail.chain) ?? '';
  const recipient =
    readRailString(metadata, chain, 'evm_recipient_address') ??
    readRailString(metadata, chain, 'recipient_address') ??
    readRailString(metadata, chain, 'payout_address') ??
    readString(metadata.evm_recipient_address ?? metadata.evmRecipientAddress) ??
    readString(metadata.recipient_address ?? metadata.recipientAddress) ??
    readString(metadata.payout_address ?? metadata.payoutAddress) ??
    readString(railConfig.default_recipient ?? railConfig.defaultRecipient) ??
    Deno.env.get('CHIVO_DEFAULT_EVM_RECIPIENT_ADDRESS') ??
    '';

  return normalizeAddress(recipient, 'recipient address');
}

function readRailString(metadata: Record<string, unknown>, chain: string, key: string) {
  const railMaps = [
    readObject(metadata.payment_amounts ?? metadata.paymentAmounts),
    readObject(metadata.rail_amounts ?? metadata.railAmounts),
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

function productAllowsRail(paymentRails: unknown, rail: PaymentRail) {
  if (!Array.isArray(paymentRails) || paymentRails.length === 0) {
    return true;
  }

  return paymentRails.some((entry) => {
    if (typeof entry === 'string') {
      return [rail.id, rail.chain, rail.provider].includes(entry);
    }

    const value = readObject(entry);
    return [value.id, value.chain, value.provider].some((candidate) => candidate && candidate === rail.id) ||
      [value.id, value.chain, value.provider].some((candidate) => candidate && candidate === rail.chain) ||
      [value.id, value.chain, value.provider].some((candidate) => candidate && candidate === rail.provider);
  });
}

function summarizeRail(rail: PaymentRail) {
  const config = readObject(rail.config);

  return {
    id: rail.id,
    railType: rail.rail_type,
    provider: rail.provider,
    chain: rail.chain,
    displayName: rail.display_name,
    networkKind: readString(config.network_kind ?? config.networkKind),
    environment: readString(config.environment),
  };
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
