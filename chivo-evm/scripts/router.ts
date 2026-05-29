import { ethers } from 'hardhat';

export async function getRouter() {
  const routerAddress = process.env.CHIVO_PAYMENT_ROUTER;

  if (!routerAddress) {
    throw new Error('Set CHIVO_PAYMENT_ROUTER to the deployed ChivoPaymentRouter address.');
  }

  return ethers.getContractAt('ChivoPaymentRouter', routerAddress);
}

export function parseBool(value: string | undefined, fallback = false) {
  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function parseTokenAddress(value: string | undefined) {
  if (!value || value.toLowerCase() === 'native' || value === ethers.ZeroAddress) {
    return ethers.ZeroAddress;
  }

  return ethers.getAddress(value);
}

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name}.`);
  }

  return value;
}
