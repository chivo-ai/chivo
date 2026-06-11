import { config as loadEnv } from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

loadEnv();

const configuredRpcUrl = process.env.EVM_RPC_URL ?? '';
const privateKey = process.env.EVM_PRIVATE_KEY?.trim() ?? '';
const alchemyKey = process.env.ALCHEMY_API_KEY?.trim() ?? '';

function accounts() {
  return privateKey ? [privateKey] : [];
}

function alchemyUrl(network: string) {
  return alchemyKey ? `https://${network}.g.alchemy.com/v2/${alchemyKey}` : '';
}

function firstUrl(...urls: Array<string | undefined>) {
  return urls.find((url) => url?.trim())?.trim() ?? '';
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
    polygon: {
      url: process.env.POLYGON_RPC_URL || alchemyUrl('polygon-mainnet'),
      accounts: accounts(),
    },
    bnb: {
      url: process.env.BNB_RPC_URL || alchemyUrl('bnb-mainnet'),
      accounts: accounts(),
    },
    bnbTestnet: {
      url: firstUrl(
        process.env.BNB_TESTNET_RPC_URL,
        alchemyUrl('bnb-testnet'),
        'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
      ),
      accounts: accounts(),
      chainId: 97,
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || '',
      bnb: process.env.BSCSCAN_API_KEY || '',
      bnbTestnet: process.env.BSCSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'bnb',
        chainId: 56,
        urls: {
          apiURL: 'https://api.bscscan.com/api',
          browserURL: 'https://bscscan.com',
        },
      },
      {
        network: 'bnbTestnet',
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
