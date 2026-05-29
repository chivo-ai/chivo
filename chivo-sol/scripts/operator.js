const anchor = require('@coral-xyz/anchor');

const { PublicKey, SystemProgram } = anchor.web3;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name}.`);
  }
  return value;
}

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function bytes32(value) {
  if (value.startsWith('0x')) {
    const hex = value.slice(2);
    if (hex.length !== 64) {
      throw new Error(`${value} is not 32 bytes.`);
    }
    return Array.from(Buffer.from(hex, 'hex'));
  }

  const buffer = Buffer.alloc(32);
  Buffer.from(value).copy(buffer);
  return Array.from(buffer);
}

function pda(programId, seeds) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = require('../target/idl/chivo_payments.json');
  const programId = new PublicKey(process.env.CHIVO_SOL_PROGRAM_ID || idl.address || idl.metadata.address);
  const program = new anchor.Program(idl, programId, provider);
  const action = requiredEnv('CHIVO_SOL_ACTION');
  const config = pda(programId, [Buffer.from('config')]);

  if (action === 'initialize') {
    await program.methods
      .initializeConfig(
        Number(process.env.CHIVO_SOL_MAX_FEE_BPS || '2500'),
        Number(process.env.CHIVO_SOL_NATIVE_FEE_BPS || '50'),
        new anchor.BN(process.env.CHIVO_SOL_AUTO_RELEASE_DELAY_SECONDS || '900')
      )
      .accounts({
        authority: provider.wallet.publicKey,
        feeCollector: new PublicKey(requiredEnv('CHIVO_SOL_FEE_COLLECTOR')),
        config,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else if (action === 'set-pause') {
    await program.methods
      .setPause(boolEnv('CHIVO_SOL_PAUSED', true))
      .accounts({ authority: provider.wallet.publicKey, config })
      .rpc();
  } else if (action === 'set-fee-collector') {
    await program.methods
      .setFeeCollector(new PublicKey(requiredEnv('CHIVO_SOL_FEE_COLLECTOR')))
      .accounts({ authority: provider.wallet.publicKey, config })
      .rpc();
  } else if (action === 'set-payout-operator') {
    await program.methods
      .setPayoutOperator(new PublicKey(requiredEnv('CHIVO_SOL_PAYOUT_OPERATOR')))
      .accounts({ authority: provider.wallet.publicKey, config })
      .rpc();
  } else if (action === 'set-native-rail') {
    await program.methods
      .setNativeRailConfig(
        boolEnv('CHIVO_SOL_RAIL_ENABLED', true),
        Number(requiredEnv('CHIVO_SOL_NATIVE_FEE_BPS')),
        new anchor.BN(process.env.CHIVO_SOL_AUTO_RELEASE_DELAY_SECONDS || '900')
      )
      .accounts({ authority: provider.wallet.publicKey, config })
      .rpc();
  } else if (action === 'create-sol-intent') {
    const intentId = Buffer.from(bytes32(requiredEnv('CHIVO_SOL_INTENT_ID')));
    const intent = pda(programId, [Buffer.from('intent'), intentId]);
    await program.methods
      .createSolIntent(
        Array.from(intentId),
        new PublicKey(requiredEnv('CHIVO_SOL_PAYER')),
        new PublicKey(requiredEnv('CHIVO_SOL_RECIPIENT')),
        new anchor.BN(requiredEnv('CHIVO_SOL_AMOUNT_LAMPORTS')),
        Number(requiredEnv('CHIVO_SOL_NATIVE_FEE_BPS')),
        new anchor.BN(requiredEnv('CHIVO_SOL_EXPIRES_AT'))
      )
      .accounts({
        authority: provider.wallet.publicKey,
        config,
        intent,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else if (action === 'deposit-sol') {
    const intentId = Buffer.from(bytes32(requiredEnv('CHIVO_SOL_INTENT_ID')));
    const intent = pda(programId, [Buffer.from('intent'), intentId]);
    await program.methods
      .depositSol()
      .accounts({
        payer: provider.wallet.publicKey,
        config,
        intent,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else if (action === 'release-sol') {
    const intentId = Buffer.from(bytes32(requiredEnv('CHIVO_SOL_INTENT_ID')));
    const intent = pda(programId, [Buffer.from('intent'), intentId]);
    await program.methods
      .releaseSol()
      .accounts({
        operator: provider.wallet.publicKey,
        config,
        intent,
        recipient: new PublicKey(requiredEnv('CHIVO_SOL_RECIPIENT')),
        feeCollector: new PublicKey(requiredEnv('CHIVO_SOL_FEE_COLLECTOR')),
      })
      .rpc();
  } else if (action === 'refund-sol') {
    const intentId = Buffer.from(bytes32(requiredEnv('CHIVO_SOL_INTENT_ID')));
    const intent = pda(programId, [Buffer.from('intent'), intentId]);
    await program.methods
      .refundSol(Array.from(Buffer.from(bytes32(process.env.CHIVO_SOL_REASON || 'refund'))))
      .accounts({
        operator: provider.wallet.publicKey,
        config,
        intent,
        payer: new PublicKey(requiredEnv('CHIVO_SOL_PAYER')),
      })
      .rpc();
  } else if (action === 'freeze-sol' || action === 'unfreeze-sol' || action === 'cancel-sol-intent') {
    const intentId = Buffer.from(bytes32(requiredEnv('CHIVO_SOL_INTENT_ID')));
    const intent = pda(programId, [Buffer.from('intent'), intentId]);
    const reason = Array.from(Buffer.from(bytes32(process.env.CHIVO_SOL_REASON || 'review')));
    const method =
      action === 'freeze-sol'
        ? program.methods.freezeSol(reason)
        : action === 'unfreeze-sol'
          ? program.methods.unfreezeSol(reason)
          : program.methods.cancelSolIntent(reason);

    await method.accounts({ authority: provider.wallet.publicKey, config, intent }).rpc();
  } else if (action === 'close-final-intent') {
    const intentId = Buffer.from(bytes32(requiredEnv('CHIVO_SOL_INTENT_ID')));
    const intent = pda(programId, [Buffer.from('intent'), intentId]);
    await program.methods
      .closeFinalIntent()
      .accounts({ authority: provider.wallet.publicKey, config, intent })
      .rpc();
  } else {
    throw new Error(`Unknown CHIVO_SOL_ACTION: ${action}`);
  }

  console.log(`Completed ${action}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
