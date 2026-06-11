import { ethers } from 'hardhat';

export async function getRouter() {
  const routerAddress = process.env.CHIVO_PAYMENT_ROUTER?.trim();

  if (!routerAddress) {
    throw new Error('Set CHIVO_PAYMENT_ROUTER to the deployed ChivoPaymentRouter address.');
  }

  return ethers.getContractAt('ChivoPaymentRouter', routerAddress);
}

export function parseBool(value: string | undefined, fallback = false) {
  const normalizedValue = value?.trim();

  if (normalizedValue === undefined || normalizedValue === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalizedValue.toLowerCase());
}

export function parseTokenAddress(value: string | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue || normalizedValue.toLowerCase() === 'native' || normalizedValue === ethers.ZeroAddress) {
    return ethers.ZeroAddress;
  }

  return ethers.getAddress(normalizedValue);
}

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name}.`);
  }

  return value;
}
