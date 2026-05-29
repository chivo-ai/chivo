import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('ChivoPaymentRouter', () => {
  async function deployRouter() {
    const [owner, authorizer, feeCollector, recipient, payer, payoutOperator, riskOperator] = await ethers.getSigners();
    const Router = await ethers.getContractFactory('ChivoPaymentRouter');
    const router = await Router.deploy(owner.address, authorizer.address, feeCollector.address);
    await router.waitForDeployment();
    await router.connect(owner).setPayoutOperator(payoutOperator.address, true);
    await router.connect(owner).setRiskOperator(riskOperator.address, true);

    return { owner, authorizer, feeCollector, recipient, payer, payoutOperator, riskOperator, router };
  }

  async function signNativeIntent(
    router: Awaited<ReturnType<typeof deployRouter>>['router'],
    authorizer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
    intentId: string,
    payer: string,
    recipient: string,
    amount: bigint,
    feeBps: number,
    expiresAt: number,
    releaseAfter: number
  ) {
    const network = await ethers.provider.getNetwork();
    const routerAddress = await router.getAddress();

    return authorizer.signTypedData(
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
      {
        intentId,
        payer,
        recipient,
        token: ethers.ZeroAddress,
        amount,
        feeBps,
        expiresAt,
        releaseAfter,
      }
    );
  }

  it('escrows a signed native payment and releases it through the payout operator', async () => {
    const { authorizer, feeCollector, recipient, payer, payoutOperator, router } = await deployRouter();
    const intentId = ethers.id('native-intent-1');
    const amount = ethers.parseEther('1');
    const feeBps = 50;
    const releaseAfter = Math.floor(Date.now() / 1000);
    const expiresAt = releaseAfter + 3600;
    const signature = await signNativeIntent(
      router,
      authorizer,
      intentId,
      payer.address,
      recipient.address,
      amount,
      feeBps,
      expiresAt,
      releaseAfter
    );

    await expect(
      router.connect(payer).depositNative(intentId, recipient.address, amount, feeBps, expiresAt, releaseAfter, signature, {
        value: amount,
      })
    )
      .to.emit(router, 'PaymentDeposited')
      .withArgs(
        intentId,
        payer.address,
        recipient.address,
        ethers.ZeroAddress,
        amount,
        ethers.parseEther('0.005'),
        ethers.parseEther('0.995'),
        feeBps,
        expiresAt,
        releaseAfter
      );

    expect(await router.escrowedNativeBalance()).to.equal(amount);

    await expect(router.connect(payoutOperator).releasePayment(intentId))
      .to.emit(router, 'PaymentReleased')
      .withArgs(
        intentId,
        payer.address,
        recipient.address,
        ethers.ZeroAddress,
        ethers.parseEther('0.005'),
        ethers.parseEther('0.995'),
        feeCollector.address
      );

    expect(await router.escrowedNativeBalance()).to.equal(0);
    expect((await router.payments(intentId)).status).to.equal(2);
  });

  it('blocks replay and cancelled intents', async () => {
    const { authorizer, recipient, payer, riskOperator, router } = await deployRouter();
    const intentId = ethers.id('native-intent-2');
    const amount = ethers.parseEther('1');
    const feeBps = 50;
    const releaseAfter = Math.floor(Date.now() / 1000);
    const expiresAt = releaseAfter + 3600;
    const signature = await signNativeIntent(
      router,
      authorizer,
      intentId,
      payer.address,
      recipient.address,
      amount,
      feeBps,
      expiresAt,
      releaseAfter
    );

    await router.connect(payer).depositNative(intentId, recipient.address, amount, feeBps, expiresAt, releaseAfter, signature, {
      value: amount,
    });

    await expect(
      router.connect(payer).depositNative(intentId, recipient.address, amount, feeBps, expiresAt, releaseAfter, signature, {
        value: amount,
      })
    ).to.be.revertedWithCustomError(router, 'IntentUnavailable');

    const cancelledIntentId = ethers.id('cancelled-intent');
    await router.connect(riskOperator).cancelIntent(cancelledIntentId, ethers.encodeBytes32String('risk'));
    const cancelledSignature = await signNativeIntent(
      router,
      authorizer,
      cancelledIntentId,
      payer.address,
      recipient.address,
      amount,
      feeBps,
      expiresAt,
      releaseAfter
    );

    await expect(
      router
        .connect(payer)
        .depositNative(cancelledIntentId, recipient.address, amount, feeBps, expiresAt, releaseAfter, cancelledSignature, {
          value: amount,
        })
    ).to.be.revertedWithCustomError(router, 'IntentUnavailable');
  });

  it('refunds a frozen payment', async () => {
    const { authorizer, recipient, payer, riskOperator, router } = await deployRouter();
    const intentId = ethers.id('native-intent-3');
    const amount = ethers.parseEther('1');
    const feeBps = 50;
    const releaseAfter = Math.floor(Date.now() / 1000);
    const expiresAt = releaseAfter + 3600;
    const signature = await signNativeIntent(
      router,
      authorizer,
      intentId,
      payer.address,
      recipient.address,
      amount,
      feeBps,
      expiresAt,
      releaseAfter
    );

    await router.connect(payer).depositNative(intentId, recipient.address, amount, feeBps, expiresAt, releaseAfter, signature, {
      value: amount,
    });
    await router.connect(riskOperator).freezePayment(intentId, ethers.encodeBytes32String('review'));

    await expect(router.connect(riskOperator).refundPayment(intentId, ethers.encodeBytes32String('refund')))
      .to.emit(router, 'PaymentRefunded')
      .withArgs(intentId, payer.address, ethers.ZeroAddress, amount, ethers.encodeBytes32String('refund'));

    expect(await router.escrowedNativeBalance()).to.equal(0);
    expect((await router.payments(intentId)).status).to.equal(3);
  });

  it('rejects mismatched payment data and blocked recipients', async () => {
    const { riskOperator, authorizer, recipient, payer, router } = await deployRouter();
    const intentId = ethers.id('native-intent-4');
    const amount = ethers.parseEther('1');
    const feeBps = 50;
    const releaseAfter = Math.floor(Date.now() / 1000);
    const expiresAt = releaseAfter + 3600;
    const signature = await signNativeIntent(
      router,
      authorizer,
      intentId,
      payer.address,
      recipient.address,
      amount,
      feeBps,
      expiresAt,
      releaseAfter
    );

    await expect(
      router
        .connect(payer)
        .depositNative(intentId, recipient.address, ethers.parseEther('2'), feeBps, expiresAt, releaseAfter, signature, {
          value: ethers.parseEther('2'),
        })
    ).to.be.revertedWithCustomError(router, 'InvalidAuthorization');

    await router.connect(riskOperator).setAccountBlocked(recipient.address, true);

    await expect(
      router.connect(payer).depositNative(intentId, recipient.address, amount, feeBps, expiresAt, releaseAfter, signature, {
        value: amount,
      })
    ).to.be.revertedWithCustomError(router, 'AccountBlocked');
  });

  it('allows the owner to update fee and recipient policy without redeploying', async () => {
    const { owner, riskOperator, authorizer, recipient, payer, router } = await deployRouter();
    await router.connect(owner).setRailConfig(ethers.ZeroAddress, true, true, 100, 1, 0, 0);
    await router.connect(riskOperator).setRecipientApproved(recipient.address, true);

    const intentId = ethers.id('native-intent-5');
    const amount = ethers.parseEther('1');
    const releaseAfter = Math.floor(Date.now() / 1000);
    const expiresAt = releaseAfter + 3600;
    const signature = await signNativeIntent(
      router,
      authorizer,
      intentId,
      payer.address,
      recipient.address,
      amount,
      100,
      expiresAt,
      releaseAfter
    );

    await expect(
      router.connect(payer).depositNative(intentId, recipient.address, amount, 100, expiresAt, releaseAfter, signature, {
        value: amount,
      })
    ).to.emit(router, 'PaymentDeposited');

    const rail = await router.railConfigs(ethers.ZeroAddress);
    expect(rail.enabled).to.equal(true);
    expect(rail.feeBps).to.equal(100);
    expect(rail.recipientAllowlistRequired).to.equal(true);
  });
});
