import { ethers } from 'hardhat';
import { getRouter, parseTokenAddress, requiredEnv } from './router';

async function main() {
  const router = await getRouter();
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const routerAddress = await router.getAddress();
  const token = parseTokenAddress(process.env.CHIVO_TOKEN);
  const intent = {
    intentId: requiredEnv('CHIVO_INTENT_ID'),
    payer: requiredEnv('CHIVO_PAYER'),
    recipient: requiredEnv('CHIVO_RECIPIENT'),
    token,
    amount: requiredEnv('CHIVO_AMOUNT_WEI'),
    feeBps: Number(requiredEnv('CHIVO_FEE_BPS')),
    expiresAt: Number(requiredEnv('CHIVO_EXPIRES_AT')),
    releaseAfter: Number(requiredEnv('CHIVO_RELEASE_AFTER')),
  };

  const signature = await signer.signTypedData(
    {
      name: 'ChivoPaymentRouter',
      version: '1',
      chainId: network.chainId,
      verifyingContract: routerAddress,
    },
    {
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
    },
    intent
  );

  console.log(JSON.stringify({ ...intent, chainId: network.chainId.toString(), router: routerAddress, signature }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
