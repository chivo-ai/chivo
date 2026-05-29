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
    polygon: {
      url: process.env.POLYGON_RPC_URL || alchemyUrl('polygon-mainnet'),
      accounts: accounts(),
    },
    bnb: {
      url: process.env.BNB_RPC_URL || alchemyUrl('bnb-mainnet'),
      accounts: accounts(),
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || '',
      bnb: process.env.BSCSCAN_API_KEY || '',
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
    ],
  },
};

export default config;
