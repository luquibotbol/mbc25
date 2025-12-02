use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgCz7s8RDr5F"); // replace with your real program id after deployment

// Temporary: we'll parse this into Pubkey in code
pub const VERIFIER_PUBKEY_STR: &str = "6xtd2k5n6bYqCkEoMxXqV4Jg6wLJ6b4rFJ9wL8hC1Pja";

#[program]
pub mod auth_nft_program {
    use super::*;
    use std::str::FromStr;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        // Store verifier pubkey inside state, so it's configurable later
        state.verifier = Pubkey::from_str(VERIFIER_PUBKEY_STR)
            .map_err(|_| ErrorCode::InvalidVerifierKey)?;
        Ok(())
    }

    /// Mint an "auth NFT" certificate for a verified item.
    /// For today, we only:
    ///  - check caller == verifier
    ///  - emit an event with item metadata
    /// Tomorrow we'll plug in NFT minting logic.
    pub fn mint_auth_nft(
        ctx: Context<MintAuthNft>,
        product_id: String,
        brand: String,
        category: String,
        metadata_uri: String,
    ) -> Result<()> {
        let state = &ctx.accounts.state;

        // Ensure the signer is the configured verifier
        let signer = ctx.accounts.verifier.key();
        require_keys_eq!(signer, state.verifier, ErrorCode::UnauthorizedVerifier);

        // For now we only emit an event; NFT mint logic comes later
        emit!(AuthNftMinted {
            verifier: signer,
            owner: ctx.accounts.owner.key(),
            product_id,
            brand,
            category,
            metadata_uri,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = 8 + State::SIZE)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts required to mint an auth NFT
#[derive(Accounts)]
pub struct MintAuthNft<'info> {
    /// Global state storing verifier
    #[account(mut)]
    pub state: Account<'info, State>,

    /// The verifier doing the authentication (must equal state.verifier)
    pub verifier: Signer<'info>,

    /// The owner who will receive the NFT certificate
    /// (for now we just record this in event, NFT mint logic later)
    /// In practice, you'd also pass token accounts, etc.
    /// but we'll wire that in tomorrow.
    /// CHECK: we don't read or write from this account yet
    #[account()]
    pub owner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct State {
    pub verifier: Pubkey,
}

impl State {
    // one pubkey
    pub const SIZE: usize = 32;
}

#[event]
pub struct AuthNftMinted {
    pub verifier: Pubkey,
    pub owner: Pubkey,
    pub product_id: String,
    pub brand: String,
    pub category: String,
    pub metadata_uri: String,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid verifier public key string.")]
    InvalidVerifierKey,
    #[msg("Caller is not authorized verifier.")]
    UnauthorizedVerifier,
}
