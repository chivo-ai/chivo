import { ethers } from 'ethers';
import hre from 'hardhat';

type RawReceipt = {
  contractAddress?: string | null;
  status?: string;
  transactionHash?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Set ${name} before deploy.`);
  }

  return value;
}

function optionalAddress(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    return undefined;
  }

  return ethers.getAddress(value);
}

function rpcUrl() {
  const networkConfig = hre.network.config as { url?: string };
  const url = networkConfig.url?.trim();

  if (!url) {
    throw new Error(`Set an RPC URL for the ${hre.network.name} network.`);
  }

  return url;
}

async function waitForReceipt(
  provider: ethers.JsonRpcProvider,
  txHash: string,
  label: string,
) {
  const timeoutMs = Number(process.env.CHIVO_DEPLOY_TIMEOUT_MS ?? 600_000);
  const pollMs = Number(process.env.CHIVO_DEPLOY_POLL_MS ?? 5_000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const receipt = (await provider.send('eth_getTransactionReceipt', [
      txHash,
    ])) as RawReceipt | null;

    if (receipt) {
      if (receipt.status && receipt.status !== '0x1') {
        throw new Error(`${label} failed onchain: ${txHash}`);
      }

      return receipt;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`${label} was broadcast but no receipt arrived: ${txHash}`);
}

async function sendRawTransaction(
  provider: ethers.JsonRpcProvider,
  wallet: ethers.Wallet,
  request: ethers.TransactionRequest,
  label: string,
) {
  const populated = await wallet.populateTransaction(request);
  const signed = await wallet.signTransaction(populated);
  const txHash = (await provider.send('eth_sendRawTransaction', [signed])) as string;
  console.log(`${label} tx`, txHash);
  return waitForReceipt(provider, txHash, label);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl());
  const wallet = new ethers.Wallet(requiredEnv('EVM_PRIVATE_KEY'), provider);
  const authorizer = ethers.getAddress(requiredEnv('CHIVO_AUTHORIZER'));
  const feeCollector = ethers.getAddress(requiredEnv('CHIVO_FEE_COLLECTOR'));
  const payoutOperator = optionalAddress('CHIVO_PAYOUT_OPERATOR');
  const riskOperator = optionalAddress('CHIVO_RISK_OPERATOR');
  const artifact = await hre.artifacts.readArtifact('ChivoPaymentRouter');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const nonce = await provider.getTransactionCount(wallet.address, 'pending');
  const expectedRouterAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce,
  });
  const deployRequest = await factory.getDeployTransaction(
    wallet.address,
    authorizer,
    feeCollector,
  );

  console.log('Network', hre.network.name);
  console.log('Expected ChivoPaymentRouter', expectedRouterAddress);

  const deployReceipt = await sendRawTransaction(
    provider,
    wallet,
    deployRequest,
    'deploy',
  );
  const routerAddress = ethers.getAddress(
    deployReceipt.contractAddress || expectedRouterAddress,
  );
  const router = new ethers.Contract(routerAddress, artifact.abi, wallet);

  if (payoutOperator) {
    await sendRawTransaction(
      provider,
      wallet,
      {
        to: routerAddress,
        data: router.interface.encodeFunctionData('setPayoutOperator', [
          payoutOperator,
          true,
        ]),
      },
      'setPayoutOperator',
    );
  }

  if (riskOperator) {
    await sendRawTransaction(
      provider,
      wallet,
      {
        to: routerAddress,
        data: router.interface.encodeFunctionData('setRiskOperator', [
          riskOperator,
          true,
        ]),
      },
      'setRiskOperator',
    );
  }

  console.log('ChivoPaymentRouter', routerAddress);
  console.log('Owner', wallet.address);
  console.log('Authorizer', authorizer);
  console.log('FeeCollector', feeCollector);
  console.log('PayoutOperator', payoutOperator || wallet.address);
  console.log('RiskOperator', riskOperator || wallet.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
