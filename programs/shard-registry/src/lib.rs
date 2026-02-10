use anchor_lang::prelude::*;

declare_id!("97Lqqtuu4bsZS6e8EacvasJe5heLbjs5pWUt1Ru83GLA");

#[program]
pub mod shard_registry {
    use super::*;

    pub fn register_shard(
        ctx: Context<RegisterShard>,
        sha: [u8; 20],
        repo: String,
        author: String,
        github_verified: bool,
    ) -> Result<()> {
        require!(repo.len() <= 64, ShardError::RepoTooLong);
        require!(author.len() <= 40, ShardError::AuthorTooLong);

        let record = &mut ctx.accounts.shard_record;
        record.mint = ctx.accounts.mint.key();
        record.sha = sha;
        record.repo = repo;
        record.author = author;
        record.github_verified = github_verified;
        record.minted_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.shard_record;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(sha: [u8; 20])]
pub struct RegisterShard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The NFT mint address being registered
    /// CHECK: We just store this pubkey, no deserialization needed
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = ShardRecord::SIZE,
        seeds = [b"shard", sha.as_ref()],
        bump,
    )]
    pub shard_record: Account<'info, ShardRecord>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct ShardRecord {
    pub mint: Pubkey,           // 32
    pub sha: [u8; 20],         // 20
    pub repo: String,           // 4 + 64
    pub author: String,         // 4 + 40
    pub github_verified: bool,  // 1
    pub minted_at: i64,        // 8
    pub bump: u8,              // 1
}

impl ShardRecord {
    // 8 (discriminator) + 32 + 20 + (4+64) + (4+40) + 1 + 8 + 1 = 182
    pub const SIZE: usize = 8 + 32 + 20 + (4 + 64) + (4 + 40) + 1 + 8 + 1;
}

#[error_code]
pub enum ShardError {
    #[msg("Repo name exceeds 64 characters")]
    RepoTooLong,
    #[msg("Author name exceeds 40 characters")]
    AuthorTooLong,
}
