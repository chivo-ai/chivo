import { config as loadEnv } from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

loadEnv();

const configuredRpcUrl = process.env.EVM_RPC_URL ?? '';
const privateKey = process.env.EVM_PRIVATE_KEY ?? '';
const alchemyKey = process.env.ALCHEMY_API_KEY ?? '';

function accounts() {
  return privateKey ? [privateKey] : [];
}

function alchemyUrl(network: string) {
  return alchemyKey ? `https://${network}.g.alchemy.com/v2/${alchemyKey}` : '';
}

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    configured: {
      url: configuredRpcUrl || 'http://127.0.0.1:8545',
      accounts: accounts(),
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || alchemyUrl('eth-sepolia'),
      accounts: accounts(),
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || alchemyUrl('base-sepolia'),
      accounts: accounts(),
    },
    bnbTestnet: {
      url: process.env.BNB_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
      accounts: accounts(),
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      baseSepolia: process.env.BASESCAN_API_KEY || '',
      bscTestnet: process.env.BSCSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'bscTestnet',
        chainId: 97,
        urls: {
          apiURL: 'https://api-testnet.bscscan.com/api',
          browserURL: 'https://testnet.bscscan.com',
        },
      },
    ],
  },
};

export default config;
