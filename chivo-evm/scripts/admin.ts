import { ethers } from 'hardhat';
import { getRouter, parseBool, parseTokenAddress, requiredEnv } from './router';

async function main() {
  const router = await getRouter();
  const action = requiredEnv('CHIVO_ADMIN_ACTION');
  const intentIds = (process.env.CHIVO_INTENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (action === 'pause') {
    await (await router.pause()).wait();
  } else if (action === 'unpause') {
    await (await router.unpause()).wait();
  } else if (action === 'set-fee-collector') {
    await (await router.setFeeCollector(requiredEnv('CHIVO_FEE_COLLECTOR'))).wait();
  } else if (action === 'set-authorizer') {
    await (await router.setAuthorizer(requiredEnv('CHIVO_AUTHORIZER'))).wait();
  } else if (action === 'set-payout-operator') {
    await (await router.setPayoutOperator(requiredEnv('CHIVO_OPERATOR'), parseBool(process.env.CHIVO_ENABLED, true))).wait();
  } else if (action === 'set-risk-operator') {
    await (await router.setRiskOperator(requiredEnv('CHIVO_OPERATOR'), parseBool(process.env.CHIVO_ENABLED, true))).wait();
  } else if (action === 'set-rail') {
    const decimals = Number(process.env.CHIVO_TOKEN_DECIMALS || '18');
    await (
      await router.setRailConfig(
        parseTokenAddress(process.env.CHIVO_TOKEN),
        parseBool(process.env.CHIVO_RAIL_ENABLED, true),
        parseBool(process.env.CHIVO_RECIPIENT_ALLOWLIST_REQUIRED),
        Number(requiredEnv('CHIVO_FEE_BPS')),
        ethers.parseUnits(process.env.CHIVO_MIN_AMOUNT || '0', decimals),
        process.env.CHIVO_MAX_AMOUNT ? ethers.parseUnits(process.env.CHIVO_MAX_AMOUNT, decimals) : 0,
        Number(process.env.CHIVO_MIN_RELEASE_DELAY || '0')
      )
    ).wait();
  } else if (action === 'block-account') {
    await (await router.setAccountBlocked(requiredEnv('CHIVO_ACCOUNT'), parseBool(process.env.CHIVO_BLOCKED, true))).wait();
  } else if (action === 'approve-recipient') {
    await (await router.setRecipientApproved(requiredEnv('CHIVO_RECIPIENT'), parseBool(process.env.CHIVO_APPROVED, true))).wait();
  } else if (action === 'cancel-intent') {
    await (await router.cancelIntent(requiredEnv('CHIVO_INTENT_ID'), ethers.encodeBytes32String(process.env.CHIVO_REASON || 'risk'))).wait();
  } else if (action === 'freeze-payment') {
    await (await router.freezePayment(requiredEnv('CHIVO_INTENT_ID'), ethers.encodeBytes32String(process.env.CHIVO_REASON || 'review'))).wait();
  } else if (action === 'unfreeze-payment') {
    await (await router.unfreezePayment(requiredEnv('CHIVO_INTENT_ID'), ethers.encodeBytes32String(process.env.CHIVO_REASON || 'clear'))).wait();
  } else if (action === 'release-payment') {
    await (await router.releasePayment(requiredEnv('CHIVO_INTENT_ID'))).wait();
  } else if (action === 'release-payments') {
    if (intentIds.length === 0) {
      throw new Error('Set CHIVO_INTENT_IDS as a comma-separated list.');
    }
    await (await router.releasePayments(intentIds)).wait();
  } else if (action === 'refund-payment') {
    await (await router.refundPayment(requiredEnv('CHIVO_INTENT_ID'), ethers.encodeBytes32String(process.env.CHIVO_REASON || 'refund'))).wait();
  } else if (action === 'refund-payments') {
    if (intentIds.length === 0) {
      throw new Error('Set CHIVO_INTENT_IDS as a comma-separated list.');
    }
    await (await router.refundPayments(intentIds, ethers.encodeBytes32String(process.env.CHIVO_REASON || 'refund'))).wait();
  } else if (action === 'withdraw-stuck-native') {
    await (
      await router.withdrawStuckNative(
        requiredEnv('CHIVO_RECOVERY_RECIPIENT'),
        ethers.parseEther(requiredEnv('CHIVO_RECOVERY_AMOUNT'))
      )
    ).wait();
  } else if (action === 'withdraw-stuck-token') {
    await (
      await router.withdrawStuckToken(
        parseTokenAddress(requiredEnv('CHIVO_TOKEN')),
        requiredEnv('CHIVO_RECOVERY_RECIPIENT'),
        ethers.parseUnits(requiredEnv('CHIVO_RECOVERY_AMOUNT'), Number(process.env.CHIVO_TOKEN_DECIMALS || '18'))
      )
    ).wait();
  } else {
    throw new Error(`Unknown CHIVO_ADMIN_ACTION: ${action}`);
  }

  console.log(`Completed ${action}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
