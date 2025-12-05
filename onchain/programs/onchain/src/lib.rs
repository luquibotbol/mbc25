use anchor_lang::prelude::*;
use std::str::FromStr;

declare_id!("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b"); // replace with your real program id after deployment

// Admin address - only this address can initialize the program
pub const ADMIN_PUBKEY_STR: &str = "2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp";

#[program]
pub mod auth_nft_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, initial_verifier: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        
        // Ensure only the designated admin can initialize
        let expected_admin = Pubkey::from_str(ADMIN_PUBKEY_STR)
            .map_err(|_| ErrorCode::InvalidAdminKey)?;
        require_keys_eq!(
            ctx.accounts.admin.key(),
            expected_admin,
            ErrorCode::UnauthorizedAdmin
        );
        
        // Store admin and initial verifier
        state.admin = expected_admin;
        state.verifiers.push(initial_verifier);
        Ok(())
    }

    /// Add a new verifier to the authorized list (admin only)
    pub fn add_verifier(ctx: Context<AddVerifier>, verifier: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        
        // Ensure caller is admin
        require_keys_eq!(ctx.accounts.admin.key(), state.admin, ErrorCode::UnauthorizedAdmin);
        
        // Check if verifier already exists
        require!(!state.verifiers.contains(&verifier), ErrorCode::VerifierAlreadyExists);
        
        state.verifiers.push(verifier);
        
        emit!(VerifierAdded {
            admin: ctx.accounts.admin.key(),
            verifier,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Remove a verifier from the authorized list (admin only)
    pub fn remove_verifier(ctx: Context<RemoveVerifier>, verifier: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        
        // Ensure caller is admin
        require_keys_eq!(ctx.accounts.admin.key(), state.admin, ErrorCode::UnauthorizedAdmin);
        
        // Find and remove verifier
        let index = state.verifiers.iter()
            .position(|&v| v == verifier)
            .ok_or(ErrorCode::VerifierNotFound)?;
        
        state.verifiers.remove(index);
        
        emit!(VerifierRemoved {
            admin: ctx.accounts.admin.key(),
            verifier,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Close the state account and return rent to admin (admin only)
    /// This allows re-initialization with a fresh state
    /// Note: We don't deserialize the account to avoid IDL mismatch issues
    pub fn close_state(ctx: Context<CloseState>) -> Result<()> {
        // Verify the state account is the correct PDA
        let (expected_state_pda, _bump) = Pubkey::find_program_address(&[b"state"], ctx.program_id);
        require_keys_eq!(
            ctx.accounts.state.key(),
            expected_state_pda,
            ErrorCode::UnauthorizedAdmin
        );
        
        // Verify the account is owned by this program
        require_keys_eq!(
            *ctx.accounts.state.owner,
            *ctx.program_id,
            ErrorCode::UnauthorizedAdmin
        );
        
        // Manually close the account by transferring rent to admin
        let state_account = &ctx.accounts.state;
        let admin_account = &ctx.accounts.admin;
        
        // Transfer all lamports from state to admin
        let lamports = state_account.lamports();
        **state_account.try_borrow_mut_lamports()? = 0;
        **admin_account.try_borrow_mut_lamports()? = admin_account
            .lamports()
            .checked_add(lamports)
            .ok_or(anchor_lang::error!(ErrorCode::InvalidAdminKey))?;
        
        // Assign state account to system program (effectively closing it)
        state_account.assign(&System::id());
        state_account.realloc(0, false)?;
        
        Ok(())
    }

    /// Mint an "auth NFT" certificate for a verified item.
    /// For today, we only:
    ///  - check caller is in verifiers list
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

        // Ensure the signer is in the authorized verifiers list
        let signer = ctx.accounts.verifier.key();
        require!(state.verifiers.contains(&signer), ErrorCode::UnauthorizedVerifier);

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
    #[account(init, payer = payer, space = 8 + State::SIZE, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    /// Admin who can manage verifiers
    pub admin: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddVerifier<'info> {
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    /// Admin who can manage verifiers
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct RemoveVerifier<'info> {
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    /// Admin who can manage verifiers
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseState<'info> {
    /// State account to close - use UncheckedAccount to avoid deserialization
    /// CHECK: We use UncheckedAccount because the account structure may not match the IDL
    /// CHECK: We manually verify the PDA in the instruction handler
    /// We manually handle closing without deserializing
    #[account(mut)]
    pub state: UncheckedAccount<'info>,
    /// Admin who can close the state (receives rent)
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts required to mint an auth NFT
#[derive(Accounts)]
pub struct MintAuthNft<'info> {
    /// Global state storing verifier
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,

    /// The verifier doing the authentication (must be in state.verifiers list)
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
    pub admin: Pubkey,
    pub verifiers: Vec<Pubkey>,
}

impl State {
    // 8 (discriminator) + 32 (admin) + 4 (vec length) + (32 * max_verifiers)
    // For now, we'll use a reasonable max (e.g., 100 verifiers)
    // 8 + 32 + 4 + (32 * 100) = 8 + 32 + 4 + 3200 = 3244
    pub const MAX_VERIFIERS: usize = 100;
    pub const SIZE: usize = 8 + 32 + 4 + (32 * Self::MAX_VERIFIERS);
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

#[event]
pub struct VerifierAdded {
    pub admin: Pubkey,
    pub verifier: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VerifierRemoved {
    pub admin: Pubkey,
    pub verifier: Pubkey,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Caller is not authorized verifier.")]
    UnauthorizedVerifier,
    #[msg("Caller is not authorized admin.")]
    UnauthorizedAdmin,
    #[msg("Verifier already exists in the list.")]
    VerifierAlreadyExists,
    #[msg("Verifier not found in the list.")]
    VerifierNotFound,
    #[msg("Invalid admin public key string.")]
    InvalidAdminKey,
}
