use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("HDDMMduXVwFKbrkNL6gEuqwmSsKUGVDoV126oBQKGX79");

#[program]
pub mod chivo_payments {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        max_fee_bps: u16,
        native_fee_bps: u16,
        auto_release_delay_seconds: i64,
    ) -> Result<()> {
        require!(max_fee_bps <= 2_500, ChivoError::InvalidFee);
        require!(native_fee_bps <= max_fee_bps, ChivoError::InvalidFee);
        require!(auto_release_delay_seconds >= 0, ChivoError::InvalidDelay);

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.payout_operator = ctx.accounts.authority.key();
        config.fee_collector = ctx.accounts.fee_collector.key();
        config.paused = false;
        config.native_payments_enabled = true;
        config.native_fee_bps = native_fee_bps;
        config.max_fee_bps = max_fee_bps;
        config.auto_release_delay_seconds = auto_release_delay_seconds;
        config.bump = ctx.bumps.config;

        emit_config(config);
        Ok(())
    }

    pub fn set_pause(ctx: Context<UpdateConfig>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(ChivoPauseUpdated { paused });
        Ok(())
    }

    pub fn set_fee_collector(ctx: Context<UpdateConfig>, fee_collector: Pubkey) -> Result<()> {
        require!(fee_collector != Pubkey::default(), ChivoError::InvalidAccount);
        ctx.accounts.config.fee_collector = fee_collector;
        emit_config(&ctx.accounts.config);
        Ok(())
    }

    pub fn set_payout_operator(ctx: Context<UpdateConfig>, payout_operator: Pubkey) -> Result<()> {
        require!(payout_operator != Pubkey::default(), ChivoError::InvalidAccount);
        ctx.accounts.config.payout_operator = payout_operator;
        emit_config(&ctx.accounts.config);
        Ok(())
    }

    pub fn set_native_rail_config(
        ctx: Context<UpdateConfig>,
        enabled: bool,
        fee_bps: u16,
        auto_release_delay_seconds: i64,
    ) -> Result<()> {
        require!(fee_bps <= ctx.accounts.config.max_fee_bps, ChivoError::InvalidFee);
        require!(auto_release_delay_seconds >= 0, ChivoError::InvalidDelay);

        ctx.accounts.config.native_payments_enabled = enabled;
        ctx.accounts.config.native_fee_bps = fee_bps;
        ctx.accounts.config.auto_release_delay_seconds = auto_release_delay_seconds;
        emit_config(&ctx.accounts.config);
        Ok(())
    }

    pub fn create_mint_rail_config(
        ctx: Context<CreateMintRailConfig>,
        mint: Pubkey,
        enabled: bool,
        fee_bps: u16,
        recipient_allowlist_required: bool,
    ) -> Result<()> {
        require!(mint != Pubkey::default(), ChivoError::InvalidAccount);
        require!(fee_bps <= ctx.accounts.config.max_fee_bps, ChivoError::InvalidFee);

        let mint_config = &mut ctx.accounts.mint_config;
        mint_config.mint = mint;
        mint_config.enabled = enabled;
        mint_config.fee_bps = fee_bps;
        mint_config.recipient_allowlist_required = recipient_allowlist_required;
        mint_config.bump = ctx.bumps.mint_config;

        emit!(ChivoMintRailConfigUpdated {
            mint,
            enabled,
            fee_bps,
            recipient_allowlist_required,
        });

        Ok(())
    }

    pub fn update_mint_rail_config(
        ctx: Context<UpdateMintRailConfig>,
        enabled: bool,
        fee_bps: u16,
        recipient_allowlist_required: bool,
    ) -> Result<()> {
        require!(fee_bps <= ctx.accounts.config.max_fee_bps, ChivoError::InvalidFee);

        let mint_config = &mut ctx.accounts.mint_config;
        mint_config.enabled = enabled;
        mint_config.fee_bps = fee_bps;
        mint_config.recipient_allowlist_required = recipient_allowlist_required;

        emit!(ChivoMintRailConfigUpdated {
            mint: mint_config.mint,
            enabled,
            fee_bps,
            recipient_allowlist_required,
        });

        Ok(())
    }

    pub fn create_sol_intent(
        ctx: Context<CreateSolIntent>,
        intent_id: [u8; 32],
        payer: Pubkey,
        recipient: Pubkey,
        amount_lamports: u64,
        fee_bps: u16,
        expires_at: i64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, ChivoError::Paused);
        require!(ctx.accounts.config.native_payments_enabled, ChivoError::RailDisabled);
        require!(recipient != Pubkey::default(), ChivoError::InvalidAccount);
        require!(amount_lamports > 0, ChivoError::InvalidAmount);
        require!(fee_bps == ctx.accounts.config.native_fee_bps, ChivoError::InvalidFee);
        require!(expires_at > Clock::get()?.unix_timestamp, ChivoError::IntentExpired);

        let intent = &mut ctx.accounts.intent;
        intent.intent_id = intent_id;
        intent.expected_payer = payer;
        intent.payer = Pubkey::default();
        intent.recipient = recipient;
        intent.amount_lamports = amount_lamports;
        intent.escrow_lamports = 0;
        intent.fee_bps = fee_bps;
        intent.expires_at = expires_at;
        intent.release_after = 0;
        intent.status = IntentStatus::Created as u8;
        intent.bump = ctx.bumps.intent;

        emit!(ChivoIntentCreated {
            intent_id,
            expected_payer: payer,
            recipient,
            amount_lamports,
            fee_bps,
            expires_at,
        });

        Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>) -> Result<()> {
        require!(!ctx.accounts.config.paused, ChivoError::Paused);
        require!(ctx.accounts.config.native_payments_enabled, ChivoError::RailDisabled);

        let now = Clock::get()?.unix_timestamp;
        let amount_lamports = ctx.accounts.intent.amount_lamports;
        require!(ctx.accounts.intent.status == IntentStatus::Created as u8, ChivoError::InvalidStatus);
        require!(ctx.accounts.intent.expires_at >= now, ChivoError::IntentExpired);
        require!(ctx.accounts.intent.fee_bps == ctx.accounts.config.native_fee_bps, ChivoError::InvalidFee);

        if ctx.accounts.intent.expected_payer != Pubkey::default() {
            require_keys_eq!(
                ctx.accounts.intent.expected_payer,
                ctx.accounts.payer.key(),
                ChivoError::InvalidAccount
            );
        }

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.intent.to_account_info(),
                },
            ),
            amount_lamports,
        )?;

        let intent = &mut ctx.accounts.intent;
        intent.payer = ctx.accounts.payer.key();
        intent.escrow_lamports = amount_lamports;
        intent.release_after = now
            .checked_add(ctx.accounts.config.auto_release_delay_seconds)
            .ok_or(ChivoError::MathOverflow)?;
        intent.status = IntentStatus::Deposited as u8;

        emit!(ChivoSolDeposited {
            intent_id: intent.intent_id,
            payer: intent.payer,
            recipient: intent.recipient,
            gross_amount: intent.amount_lamports,
            fee_bps: intent.fee_bps,
            release_after: intent.release_after,
        });

        Ok(())
    }

    pub fn release_sol(ctx: Context<ReleaseSol>) -> Result<()> {
        ensure_payout_operator(&ctx.accounts.config, &ctx.accounts.operator)?;
        require!(!ctx.accounts.config.paused, ChivoError::Paused);
        require_keys_eq!(ctx.accounts.fee_collector.key(), ctx.accounts.config.fee_collector, ChivoError::InvalidAccount);
        require_keys_eq!(ctx.accounts.recipient.key(), ctx.accounts.intent.recipient, ChivoError::InvalidAccount);

        let now = Clock::get()?.unix_timestamp;
        require!(ctx.accounts.intent.status == IntentStatus::Deposited as u8, ChivoError::InvalidStatus);
        require!(ctx.accounts.intent.release_after <= now, ChivoError::IntentNotReady);

        let escrow_lamports = ctx.accounts.intent.escrow_lamports;
        let fee = calculate_fee(escrow_lamports, ctx.accounts.intent.fee_bps)?;
        let net = escrow_lamports
            .checked_sub(fee)
            .ok_or(ChivoError::MathOverflow)?;
        let intent_id = ctx.accounts.intent.intent_id;
        let payer = ctx.accounts.intent.payer;
        let recipient = ctx.accounts.intent.recipient;
        let gross_amount = ctx.accounts.intent.amount_lamports;
        let fee_bps = ctx.accounts.intent.fee_bps;

        {
            let intent = &mut ctx.accounts.intent;
            intent.status = IntentStatus::Released as u8;
            intent.escrow_lamports = 0;
        }

        transfer_from_intent(&ctx.accounts.intent.to_account_info(), &ctx.accounts.fee_collector.to_account_info(), fee)?;
        transfer_from_intent(&ctx.accounts.intent.to_account_info(), &ctx.accounts.recipient.to_account_info(), net)?;

        emit!(ChivoSolReleased {
            intent_id,
            payer,
            recipient,
            gross_amount,
            platform_fee: fee,
            net_amount: net,
            fee_bps,
        });

        Ok(())
    }

    pub fn refund_sol(ctx: Context<RefundSol>, reason_code: [u8; 32]) -> Result<()> {
        ensure_payout_operator(&ctx.accounts.config, &ctx.accounts.operator)?;
        require_keys_eq!(ctx.accounts.payer.key(), ctx.accounts.intent.payer, ChivoError::InvalidAccount);

        require!(
            ctx.accounts.intent.status == IntentStatus::Deposited as u8
                || ctx.accounts.intent.status == IntentStatus::Frozen as u8,
            ChivoError::InvalidStatus
        );

        let refund_amount = ctx.accounts.intent.escrow_lamports;
        let intent_id = ctx.accounts.intent.intent_id;
        let payer = ctx.accounts.intent.payer;

        {
            let intent = &mut ctx.accounts.intent;
            intent.status = IntentStatus::Refunded as u8;
            intent.escrow_lamports = 0;
        }

        transfer_from_intent(&ctx.accounts.intent.to_account_info(), &ctx.accounts.payer.to_account_info(), refund_amount)?;

        emit!(ChivoSolRefunded {
            intent_id,
            payer,
            gross_amount: refund_amount,
            reason_code,
        });

        Ok(())
    }

    pub fn freeze_sol(ctx: Context<AuthorityIntentUpdate>, reason_code: [u8; 32]) -> Result<()> {
        require!(ctx.accounts.intent.status == IntentStatus::Deposited as u8, ChivoError::InvalidStatus);
        ctx.accounts.intent.status = IntentStatus::Frozen as u8;
        emit!(ChivoSolFrozen {
            intent_id: ctx.accounts.intent.intent_id,
            frozen: true,
            reason_code,
        });
        Ok(())
    }

    pub fn unfreeze_sol(ctx: Context<AuthorityIntentUpdate>, reason_code: [u8; 32]) -> Result<()> {
        require!(ctx.accounts.intent.status == IntentStatus::Frozen as u8, ChivoError::InvalidStatus);
        ctx.accounts.intent.status = IntentStatus::Deposited as u8;
        emit!(ChivoSolFrozen {
            intent_id: ctx.accounts.intent.intent_id,
            frozen: false,
            reason_code,
        });
        Ok(())
    }

    pub fn cancel_sol_intent(ctx: Context<AuthorityIntentUpdate>, reason_code: [u8; 32]) -> Result<()> {
        require!(ctx.accounts.intent.status == IntentStatus::Created as u8, ChivoError::InvalidStatus);
        ctx.accounts.intent.status = IntentStatus::Cancelled as u8;
        emit!(ChivoSolIntentCancelled {
            intent_id: ctx.accounts.intent.intent_id,
            reason_code,
        });
        Ok(())
    }

    pub fn close_final_intent(ctx: Context<CloseFinalIntent>) -> Result<()> {
        require!(
            ctx.accounts.intent.status == IntentStatus::Released as u8
                || ctx.accounts.intent.status == IntentStatus::Refunded as u8
                || ctx.accounts.intent.status == IntentStatus::Cancelled as u8,
            ChivoError::InvalidStatus
        );
        require!(ctx.accounts.intent.escrow_lamports == 0, ChivoError::EscrowNotEmpty);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Receives platform fees.
    pub fee_collector: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + ChivoConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ChivoConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, ChivoConfig>,
}

#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct CreateMintRailConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + MintRailConfig::LEN,
        seeds = [b"mint-config", mint.as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintRailConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMintRailConfig<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(mut)]
    pub mint_config: Account<'info, MintRailConfig>,
}

#[derive(Accounts)]
#[instruction(intent_id: [u8; 32])]
pub struct CreateSolIntent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + PaymentIntent::LEN,
        seeds = [b"intent", intent_id.as_ref()],
        bump
    )]
    pub intent: Account<'info, PaymentIntent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(mut)]
    pub intent: Account<'info, PaymentIntent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseSol<'info> {
    pub operator: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(mut)]
    pub intent: Account<'info, PaymentIntent>,
    /// CHECK: Checked against intent recipient.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    /// CHECK: Checked against config fee collector.
    #[account(mut)]
    pub fee_collector: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RefundSol<'info> {
    pub operator: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(mut)]
    pub intent: Account<'info, PaymentIntent>,
    /// CHECK: Checked against intent payer.
    #[account(mut)]
    pub payer: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct AuthorityIntentUpdate<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(mut)]
    pub intent: Account<'info, PaymentIntent>,
}

#[derive(Accounts)]
pub struct CloseFinalIntent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, ChivoConfig>,
    #[account(mut, close = authority)]
    pub intent: Account<'info, PaymentIntent>,
}

#[account]
pub struct ChivoConfig {
    pub authority: Pubkey,
    pub payout_operator: Pubkey,
    pub fee_collector: Pubkey,
    pub paused: bool,
    pub native_payments_enabled: bool,
    pub native_fee_bps: u16,
    pub max_fee_bps: u16,
    pub auto_release_delay_seconds: i64,
    pub bump: u8,
}

impl ChivoConfig {
    pub const LEN: usize = 32 + 32 + 32 + 1 + 1 + 2 + 2 + 8 + 1;
}

#[account]
pub struct MintRailConfig {
    pub mint: Pubkey,
    pub enabled: bool,
    pub fee_bps: u16,
    pub recipient_allowlist_required: bool,
    pub bump: u8,
}

impl MintRailConfig {
    pub const LEN: usize = 32 + 1 + 2 + 1 + 1;
}

#[account]
pub struct PaymentIntent {
    pub intent_id: [u8; 32],
    pub expected_payer: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    pub escrow_lamports: u64,
    pub fee_bps: u16,
    pub expires_at: i64,
    pub release_after: i64,
    pub status: u8,
    pub bump: u8,
}

impl PaymentIntent {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 8 + 8 + 2 + 8 + 8 + 1 + 1;
}

#[repr(u8)]
pub enum IntentStatus {
    Created = 0,
    Deposited = 1,
    Released = 2,
    Refunded = 3,
    Frozen = 4,
    Cancelled = 5,
}

fn ensure_payout_operator(config: &ChivoConfig, signer: &Signer) -> Result<()> {
    let signer_key = signer.key();
    require!(
        signer_key == config.authority || signer_key == config.payout_operator,
        ChivoError::Unauthorized
    );
    Ok(())
}

fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    let fee = amount
        .checked_mul(fee_bps as u64)
        .ok_or(ChivoError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ChivoError::MathOverflow)?;

    Ok(fee)
}

fn transfer_from_intent<'info>(
    intent: &AccountInfo<'info>,
    recipient: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    **intent.try_borrow_mut_lamports()? = intent
        .lamports()
        .checked_sub(amount)
        .ok_or(ChivoError::MathOverflow)?;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(amount)
        .ok_or(ChivoError::MathOverflow)?;

    Ok(())
}

fn emit_config(config: &ChivoConfig) {
    emit!(ChivoConfigUpdated {
        fee_collector: config.fee_collector,
        payout_operator: config.payout_operator,
        native_payments_enabled: config.native_payments_enabled,
        native_fee_bps: config.native_fee_bps,
        max_fee_bps: config.max_fee_bps,
        auto_release_delay_seconds: config.auto_release_delay_seconds,
    });
}

#[event]
pub struct ChivoConfigUpdated {
    pub fee_collector: Pubkey,
    pub payout_operator: Pubkey,
    pub native_payments_enabled: bool,
    pub native_fee_bps: u16,
    pub max_fee_bps: u16,
    pub auto_release_delay_seconds: i64,
}

#[event]
pub struct ChivoPauseUpdated {
    pub paused: bool,
}

#[event]
pub struct ChivoMintRailConfigUpdated {
    pub mint: Pubkey,
    pub enabled: bool,
    pub fee_bps: u16,
    pub recipient_allowlist_required: bool,
}

#[event]
pub struct ChivoIntentCreated {
    pub intent_id: [u8; 32],
    pub expected_payer: Pubkey,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    pub fee_bps: u16,
    pub expires_at: i64,
}

#[event]
pub struct ChivoSolDeposited {
    pub intent_id: [u8; 32],
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub gross_amount: u64,
    pub fee_bps: u16,
    pub release_after: i64,
}

#[event]
pub struct ChivoSolReleased {
    pub intent_id: [u8; 32],
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub gross_amount: u64,
    pub platform_fee: u64,
    pub net_amount: u64,
    pub fee_bps: u16,
}

#[event]
pub struct ChivoSolRefunded {
    pub intent_id: [u8; 32],
    pub payer: Pubkey,
    pub gross_amount: u64,
    pub reason_code: [u8; 32],
}

#[event]
pub struct ChivoSolFrozen {
    pub intent_id: [u8; 32],
    pub frozen: bool,
    pub reason_code: [u8; 32],
}

#[event]
pub struct ChivoSolIntentCancelled {
    pub intent_id: [u8; 32],
    pub reason_code: [u8; 32],
}

#[error_code]
pub enum ChivoError {
    #[msg("Program is paused.")]
    Paused,
    #[msg("Payment rail is disabled.")]
    RailDisabled,
    #[msg("Signer is not allowed to perform this payout action.")]
    Unauthorized,
    #[msg("Invalid account.")]
    InvalidAccount,
    #[msg("Invalid amount.")]
    InvalidAmount,
    #[msg("Invalid fee.")]
    InvalidFee,
    #[msg("Invalid release delay.")]
    InvalidDelay,
    #[msg("Payment intent expired.")]
    IntentExpired,
    #[msg("Payment intent is not ready for release.")]
    IntentNotReady,
    #[msg("Payment intent status does not allow this action.")]
    InvalidStatus,
    #[msg("Payment intent still has escrowed funds.")]
    EscrowNotEmpty,
    #[msg("Math overflow.")]
    MathOverflow,
}
