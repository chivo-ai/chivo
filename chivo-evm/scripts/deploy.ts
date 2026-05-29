import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  const authorizer = process.env.CHIVO_AUTHORIZER;
  const feeCollector = process.env.CHIVO_FEE_COLLECTOR;
  const payoutOperator = process.env.CHIVO_PAYOUT_OPERATOR;
  const riskOperator = process.env.CHIVO_RISK_OPERATOR;

  if (!authorizer || !feeCollector) {
    throw new Error('Set CHIVO_AUTHORIZER and CHIVO_FEE_COLLECTOR before deploy.');
  }

  const Router = await ethers.getContractFactory('ChivoPaymentRouter');
  const router = await Router.deploy(deployer.address, authorizer, feeCollector);
  await router.waitForDeployment();

  if (payoutOperator) {
    const tx = await router.setPayoutOperator(payoutOperator, true);
    await tx.wait();
  }

  if (riskOperator) {
    const tx = await router.setRiskOperator(riskOperator, true);
    await tx.wait();
  }

  console.log('ChivoPaymentRouter', await router.getAddress());
  console.log('Owner', deployer.address);
  console.log('Authorizer', authorizer);
  console.log('FeeCollector', feeCollector);
  console.log('PayoutOperator', payoutOperator || deployer.address);
  console.log('RiskOperator', riskOperator || deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
