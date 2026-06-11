-- Chivo AI Group 14 upgrade for chain-neutral payment rails.
-- Polygon mainnet is the only enabled checkout rail for now.
-- Solana, Sui, and BNB testnet are present as disabled/future rails so they can
-- be enabled later from the database without hardcoding app logic.

insert into public.platform_settings (key, value, description)
values (
  'billing_control',
  '{
    "billing_enabled": true,
    "platform_fee_bps": 50,
    "crypto_rails_enabled": true,
    "traditional_rails_enabled": false,
    "message": null
  }'::jsonb,
  'Controls global billing enforcement, payment rails, and Chivo platform fee.'
)
on conflict (key) do update
set
  value = public.platform_settings.value || excluded.value,
  description = excluded.description,
  updated_at = now();

alter table public.contract_program_registry
drop constraint if exists contract_program_registry_kind_check;

alter table public.contract_program_registry
add constraint contract_program_registry_kind_check check (
  kind in ('evm_contract', 'solana_program', 'sui_package')
);

insert into public.contract_program_registry (
  chain,
  address,
  kind,
  status,
  audit_status,
  version,
  metadata
)
values
  (
    'polygon-mainnet',
    '0x37C7a3C21DEAc9c6f9Cf0Ac1A357E38B23320b2a',
    'evm_contract',
    'active',
    'internal_review',
    'chivo-router-v1',
    '{
      "network_kind": "evm",
      "chain_id": 137,
      "router_name": "ChivoPaymentRouter",
      "environment": "mainnet",
      "explorer_url": "https://polygonscan.com/address/0x37C7a3C21DEAc9c6f9Cf0Ac1A357E38B23320b2a"
    }'::jsonb
  ),
  (
    'bnb-testnet',
    'pending',
    'evm_contract',
    'testnet',
    'not_started',
    'chivo-router-v1',
    '{
      "network_kind": "evm",
      "chain_id": 97,
      "router_name": "ChivoPaymentRouter",
      "environment": "testnet"
    }'::jsonb
  ),
  (
    'solana-devnet',
    'pending',
    'solana_program',
    'testnet',
    'not_started',
    'chivo-payments-v1',
    '{
      "network_kind": "solana",
      "environment": "devnet"
    }'::jsonb
  ),
  (
    'sui-testnet',
    'pending',
    'sui_package',
    'testnet',
    'not_started',
    'chivo-payments-v1',
    '{
      "network_kind": "sui",
      "environment": "testnet"
    }'::jsonb
  )
on conflict (chain, address) do update
set
  kind = excluded.kind,
  status = excluded.status,
  audit_status = excluded.audit_status,
  version = excluded.version,
  metadata = public.contract_program_registry.metadata || excluded.metadata,
  updated_at = now();

insert into public.payment_rail_settings (
  rail_type,
  provider,
  chain,
  status,
  display_name,
  config
)
values
  (
    'crypto',
    'chivo-evm-router',
    'polygon-mainnet',
    'enabled',
    'Polygon',
    '{
      "network_kind": "evm",
      "environment": "mainnet",
      "chain_id": 137,
      "native_symbol": "POL",
      "token_decimals": 18,
      "settlement_asset": "POL",
      "fee_bps": 50,
      "contract_kind": "evm_contract",
      "token_address": "0x0000000000000000000000000000000000000000",
      "contract_address": "0x37C7a3C21DEAc9c6f9Cf0Ac1A357E38B23320b2a",
      "router_address": "0x37C7a3C21DEAc9c6f9Cf0Ac1A357E38B23320b2a",
      "explorer_url": "https://polygonscan.com",
      "active_for_checkout": true,
      "sort_order": 10
    }'::jsonb
  ),
  (
    'crypto',
    'chivo-evm-router',
    'bnb-testnet',
    'disabled',
    'BNB Testnet',
    '{
      "network_kind": "evm",
      "environment": "testnet",
      "chain_id": 97,
      "native_symbol": "tBNB",
      "token_decimals": 18,
      "settlement_asset": "tBNB",
      "fee_bps": 50,
      "contract_kind": "evm_contract",
      "token_address": "0x0000000000000000000000000000000000000000",
      "contract_address": null,
      "router_address": null,
      "explorer_url": "https://testnet.bscscan.com",
      "active_for_checkout": false,
      "sort_order": 80
    }'::jsonb
  ),
  (
    'crypto',
    'chivo-solana-program',
    'solana-devnet',
    'disabled',
    'Solana Devnet',
    '{
      "network_kind": "solana",
      "environment": "devnet",
      "native_symbol": "SOL",
      "settlement_asset": "SOL",
      "contract_kind": "solana_program",
      "program_id": null,
      "active_for_checkout": false,
      "sort_order": 90
    }'::jsonb
  ),
  (
    'crypto',
    'chivo-sui-package',
    'sui-testnet',
    'disabled',
    'Sui Testnet',
    '{
      "network_kind": "sui",
      "environment": "testnet",
      "native_symbol": "SUI",
      "settlement_asset": "SUI",
      "contract_kind": "sui_package",
      "package_id": null,
      "config_object_id": null,
      "active_for_checkout": false,
      "sort_order": 100
    }'::jsonb
  )
on conflict (rail_type, provider, chain) do update
set
  status = excluded.status,
  display_name = excluded.display_name,
  config = public.payment_rail_settings.config || excluded.config,
  updated_at = now();
