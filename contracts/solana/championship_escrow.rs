use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("AvNFV1Bg6ZfngTuGdd5uDDxV22nsmumYd3JUpkQu9MPT");

// ─── Constants ───────────────────────────────────────────────────────
pub const MAX_AGENTS: usize = 64;
pub const MIN_FEE: u64 = 10_000_000;             // 0.01 SOL in lamports
pub const MIN_AGENTS: u32 = 3;
pub const MIN_VOTE_BALANCE: u64 = 1_000_000_000; // 1 SOL in lamports

pub const EW: u64 = 95; // entry pool → winner agent owner %
pub const EC: u64 = 4;  // entry pool → creator %
pub const EP: u64 = 1;  // entry pool → platform %
pub const BW: u64 = 95; // bet pool   → winning bettors %
pub const BC: u64 = 2;  // bet pool   → creator %
pub const BP: u64 = 3;  // bet pool   → platform %

pub const REFUND_PCT: u64 = 98; // % of entry fee returned on withdraw
pub const PEEK_FEE_PCT: u64 = 2; // % of entry fee kept as peek fee (→ platform)

// PDA seeds
pub const CHALLENGE_SEED: &[u8] = b"challenge";
pub const VAULT_SEED: &[u8] = b"vault";
pub const ENROLL_SEED: &[u8] = b"enroll";
pub const BET_SEED: &[u8] = b"bet";
pub const USER_BET_TOTAL_SEED: &[u8] = b"user_bet_total";
pub const VOTE_RECORD_SEED: &[u8] = b"vote_record";
pub const CLAIM_RECORD_SEED: &[u8] = b"claim_record";

// ─── Errors ──────────────────────────────────────────────────────────
#[error_code]
pub enum EscrowError {
    #[msg("E3: Entry fee below minimum")]
    FeeTooLow,            // 6000
    #[msg("E4: Invalid timestamp ordering")]
    BadTimestamps,        // 6001
    #[msg("E6: Enrollment period ended")]
    EnrollmentEnded,      // 6002
    #[msg("E7: Challenge is cancelled")]
    Cancelled,            // 6003
    #[msg("E8: Attached SOL != entry fee")]
    WrongFee,             // 6004
    #[msg("E9: Caller already enrolled")]
    AlreadyEnrolled,      // 6005
    #[msg("E10: Agent ID already taken")]
    AgentTaken,           // 6006
    #[msg("E11: Challenge not active")]
    NotActive,            // 6007
    #[msg("E12: Fewer than 3 agents enrolled")]
    TooFewAgents,         // 6008
    #[msg("E13: Wrong phase for this action")]
    WrongPhase,           // 6009
    #[msg("E14: Agent not enrolled")]
    AgentNotEnrolled,     // 6010
    #[msg("E15: (reserved — CreatorBet removed)")]
    Reserved6011,         // 6011
    #[msg("E16: Bet amount is zero")]
    ZeroBet,              // 6012
    #[msg("E17: Already voted")]
    AlreadyVoted,         // 6013
    #[msg("E18: Voter SOL balance below minimum")]
    LowBalance,           // 6014
    #[msg("E19: Required period has not ended yet")]
    NotEnded,             // 6015
    #[msg("E20: Cannot cancel — enough agents enrolled")]
    CannotCancel,         // 6016
    #[msg("E22: Challenge neither finalized nor cancelled")]
    NotDone,              // 6017
    #[msg("E23: Already claimed")]
    AlreadyClaimed,       // 6018
    #[msg("E24: Nothing to claim")]
    NoPayout,             // 6019
    #[msg("E25: Maximum agent capacity reached")]
    MaxAgents,            // 6020
    #[msg("E26: Vault balance insufficient")]
    InsufficientVault,    // 6021
    #[msg("E27: Arithmetic overflow")]
    Overflow,             // 6022
    #[msg("E28: Agent has been withdrawn")]
    AgentWithdrawn,       // 6023
    #[msg("E29: Agent already withdrawn")]
    AlreadyWithdrawn,     // 6024
    #[msg("E30: Not the agent owner")]
    NotAgentOwner,        // 6025
}

// ─── Events ──────────────────────────────────────────────────────────
#[event]
pub struct ChallengeCreated {
    pub challenge_id: [u8; 32],
    pub creator: Pubkey,
    pub entry_fee: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub judge_end: i64,
    pub challenge_hash: [u8; 32],
    pub competition_duration: i64,
    pub refund_duration: i64,
}

#[event]
pub struct AgentEnrolled {
    pub challenge_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub owner: Pubkey,
}

#[event]
pub struct BetPlaced {
    pub challenge_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub bettor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct VoteCast {
    pub challenge_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub voter: Pubkey,
}

#[event]
pub struct ChallengeFinalized {
    pub challenge_id: [u8; 32],
    pub winner_agent_id: [u8; 32],
    pub winner_owner: Pubkey,
    pub platform_fee: u64,
}

#[event]
pub struct ChallengeCancelled {
    pub challenge_id: [u8; 32],
}

#[event]
pub struct PayoutClaimed {
    pub challenge_id: [u8; 32],
    pub claimant: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AgentWithdrawnEvent {
    pub challenge_id: [u8; 32],
    pub agent_id: [u8; 32],
    pub owner: Pubkey,
    pub refund_amount: u64,
    pub peek_fee: u64,
}

// ═══════════════════════════════════════════════════════════════════════
// ACCOUNT STRUCTURES
// ═══════════════════════════════════════════════════════════════════════

/// Main challenge state — holds all per-challenge data in parallel
/// arrays to avoid many small PDA allocations.
#[account]
pub struct Challenge {
    pub creator: Pubkey,            // 32
    pub platform: Pubkey,           // 32
    pub challenge_id: [u8; 32],     // 32

    pub entry_fee: u64,             // 8
    pub start_time: i64,            // 8  (was enroll_end — enrollment closes, challenge public)
    pub end_time: i64,              // 8  (was compete_end — competition ends, judging begins)
    pub judge_end: i64,             // 8

    pub challenge_hash: [u8; 32],   // 32 (SHA-256 of full_challenge for commit-reveal integrity)
    pub competition_duration: i64,  // 8  (seconds per agent after reveal)
    pub refund_duration: i64,       // 8  (seconds after reveal for refund window)

    pub total_entry_pool: u64,      // 8
    pub total_bet_pool: u64,        // 8

    pub agent_count: u32,           // 4
    pub finalized: bool,            // 1
    pub cancelled: bool,            // 1
    pub winner_index: u8,           // 1 (index into agent arrays)

    pub bump: u8,                   // 1
    pub vault_bump: u8,             // 1

    // Parallel arrays (all indexed by agent position)
    pub agent_ids: Vec<[u8; 32]>,       // 4 + 32*N
    pub agent_owners: Vec<Pubkey>,      // 4 + 32*N
    pub vote_counts: Vec<u64>,          // 4 +  8*N
    pub agent_bet_pools: Vec<u64>,      // 4 +  8*N
    pub withdrawn: Vec<bool>,           // 4 +  1*N (true if agent withdrew)
}

impl Challenge {
    /// Compute space for init — worst case with `max` agents.
    pub fn space(max: usize) -> usize {
        8                          // anchor discriminator
        + 32                       // creator
        + 32                       // platform
        + 32                       // challenge_id
        + 8                        // entry_fee
        + 8                        // start_time
        + 8                        // end_time
        + 8                        // judge_end
        + 32                       // challenge_hash
        + 8                        // competition_duration
        + 8                        // refund_duration
        + 8                        // total_entry_pool
        + 8                        // total_bet_pool
        + 4                        // agent_count
        + 1                        // finalized
        + 1                        // cancelled
        + 1                        // winner_index
        + 1                        // bump
        + 1                        // vault_bump
        + (4 + 32 * max)           // agent_ids
        + (4 + 32 * max)           // agent_owners
        + (4 + 8 * max)            // vote_counts
        + (4 + 8 * max)            // agent_bet_pools
        + (4 + 1 * max)            // withdrawn
    }

    /// Find agent index by ID or return None.
    pub fn find_agent(&self, agent_id: &[u8; 32]) -> Option<usize> {
        self.agent_ids.iter().position(|id| id == agent_id)
    }

    /// Count active (non-withdrawn) agents.
    pub fn active_agent_count(&self) -> u32 {
        self.withdrawn.iter().filter(|&&w| !w).count() as u32
    }

    /// Return winner agent_id (panics if no agents).
    pub fn winner_agent_id(&self) -> [u8; 32] {
        self.agent_ids[self.winner_index as usize]
    }

    /// Return winner owner.
    pub fn winner_owner(&self) -> Pubkey {
        self.agent_owners[self.winner_index as usize]
    }
}

/// Proves a user enrolled in a specific challenge.
#[account]
pub struct EnrollRecord {
    pub bump: u8, // 1
}

impl EnrollRecord {
    pub const SPACE: usize = 8 + 1;
}

/// Accumulates a user's bet on a specific agent in a specific challenge.
#[account]
pub struct BetRecord {
    pub amount: u64, // 8
    pub bump: u8,    // 1
}

impl BetRecord {
    pub const SPACE: usize = 8 + 8 + 1;
}

/// Tracks user's total bets across all agents in a challenge (for refunds).
#[account]
pub struct UserBetTotal {
    pub total: u64, // 8
    pub bump: u8,   // 1
}

impl UserBetTotal {
    pub const SPACE: usize = 8 + 8 + 1;
}

/// Proves a user voted in a specific challenge.
#[account]
pub struct VoteRecord {
    pub bump: u8, // 1
}

impl VoteRecord {
    pub const SPACE: usize = 8 + 1;
}

/// Proves a user already claimed.
#[account]
pub struct ClaimRecord {
    pub bump: u8, // 1
}

impl ClaimRecord {
    pub const SPACE: usize = 8 + 1;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTEXTS (Account Validation)
// ═══════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(
    challenge_id: [u8; 32],
    entry_fee: u64,
    start_time: i64,
    end_time: i64,
    judge_end: i64,
    challenge_hash: [u8; 32],
    competition_duration: i64,
    refund_duration: i64,
)]
pub struct Create<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: platform address stored, validated as non-zero off-chain
    pub platform: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = Challenge::space(MAX_AGENTS),
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// Vault PDA — a system account that holds all escrowed SOL.
    /// CHECK: PDA derived from known seeds; this program owns it.
    #[account(
        mut,
        seeds = [VAULT_SEED, &challenge_id],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 32], agent_id: [u8; 32])]
pub struct Enroll<'info> {
    #[account(mut)]
    pub enrollee: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// CHECK: Vault PDA — SOL goes here.
    #[account(
        mut,
        seeds = [VAULT_SEED, &challenge_id],
        bump = challenge.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// EnrollRecord PDA — init proves first enrollment.
    #[account(
        init,
        payer = enrollee,
        space = EnrollRecord::SPACE,
        seeds = [ENROLL_SEED, &challenge_id, enrollee.key().as_ref()],
        bump,
    )]
    pub enroll_record: Account<'info, EnrollRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 32], agent_id: [u8; 32], amount: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// CHECK: Vault PDA.
    #[account(
        mut,
        seeds = [VAULT_SEED, &challenge_id],
        bump = challenge.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// Per-user per-agent bet accumulator.
    #[account(
        init_if_needed,
        payer = bettor,
        space = BetRecord::SPACE,
        seeds = [BET_SEED, &challenge_id, bettor.key().as_ref(), &agent_id],
        bump,
    )]
    pub bet_record: Account<'info, BetRecord>,

    /// Per-user total bets in this challenge (for refunds).
    #[account(
        init_if_needed,
        payer = bettor,
        space = UserBetTotal::SPACE,
        seeds = [USER_BET_TOTAL_SEED, &challenge_id, bettor.key().as_ref()],
        bump,
    )]
    pub user_bet_total: Account<'info, UserBetTotal>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 32], agent_id: [u8; 32])]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// Vote record — init proves first vote.
    #[account(
        init,
        payer = voter,
        space = VoteRecord::SPACE,
        seeds = [VOTE_RECORD_SEED, &challenge_id, voter.key().as_ref()],
        bump,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 32])]
pub struct CancelChallenge<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 32])]
pub struct Finalize<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// CHECK: Vault PDA — platform fee withdrawn here.
    #[account(
        mut,
        seeds = [VAULT_SEED, &challenge_id],
        bump = challenge.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: Must match challenge.platform
    #[account(
        mut,
        constraint = platform.key() == challenge.platform
    )]
    pub platform: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 32])]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// CHECK: Vault PDA — lamports withdrawn from here.
    #[account(
        mut,
        seeds = [VAULT_SEED, &challenge_id],
        bump = challenge.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// Claim record — init proves first claim.
    #[account(
        init,
        payer = claimant,
        space = ClaimRecord::SPACE,
        seeds = [CLAIM_RECORD_SEED, &challenge_id, claimant.key().as_ref()],
        bump,
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    /// EnrollRecord — optional. If it exists, the user enrolled.
    pub enroll_record: Option<Account<'info, EnrollRecord>>,

    /// BetRecord for the winner agent — optional.
    pub winner_bet_record: Option<Account<'info, BetRecord>>,

    /// UserBetTotal — optional. Needed for cancelled refunds.
    pub user_bet_total: Option<Account<'info, UserBetTotal>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: [u8; 32], agent_id: [u8; 32])]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &challenge_id],
        bump = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// CHECK: Vault PDA — refund withdrawn from here.
    #[account(
        mut,
        seeds = [VAULT_SEED, &challenge_id],
        bump = challenge.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: Must match challenge.platform — peek fee goes here.
    #[account(
        mut,
        constraint = platform.key() == challenge.platform
    )]
    pub platform: UncheckedAccount<'info>,

    /// EnrollRecord PDA — proves the caller enrolled.
    /// CHECK: Must be the correct PDA for this caller + challenge.
    #[account(
        seeds = [ENROLL_SEED, &challenge_id, caller.key().as_ref()],
        bump = enroll_record.bump,
    )]
    pub enroll_record: Account<'info, EnrollRecord>,

    pub system_program: Program<'info, System>,
}


// ═══════════════════════════════════════════════════════════════════════
// PROGRAM LOGIC
// ═══════════════════════════════════════════════════════════════════════
#[program]
pub mod championship_escrow {
    use super::*;

    // ─── 1. CREATE ───────────────────────────────────────────────────
    pub fn create(
        ctx: Context<Create>,
        challenge_id: [u8; 32],
        entry_fee: u64,
        start_time: i64,
        end_time: i64,
        judge_end: i64,
        challenge_hash: [u8; 32],
        competition_duration: i64,
        refund_duration: i64,
    ) -> Result<()> {
        require!(entry_fee >= MIN_FEE, EscrowError::FeeTooLow);

        let now = Clock::get()?.unix_timestamp;
        require!(start_time > now, EscrowError::BadTimestamps);
        require!(end_time > start_time, EscrowError::BadTimestamps);
        require!(judge_end > end_time, EscrowError::BadTimestamps);
        require!(competition_duration > 0, EscrowError::BadTimestamps);
        require!(refund_duration > 0, EscrowError::BadTimestamps);

        let ch = &mut ctx.accounts.challenge;
        ch.creator = ctx.accounts.creator.key();
        ch.platform = ctx.accounts.platform.key();
        ch.challenge_id = challenge_id;
        ch.entry_fee = entry_fee;
        ch.start_time = start_time;
        ch.end_time = end_time;
        ch.judge_end = judge_end;
        ch.challenge_hash = challenge_hash;
        ch.competition_duration = competition_duration;
        ch.refund_duration = refund_duration;
        ch.total_entry_pool = 0;
        ch.total_bet_pool = 0;
        ch.agent_count = 0;
        ch.finalized = false;
        ch.cancelled = false;
        ch.winner_index = 0;
        ch.bump = ctx.bumps.challenge;
        ch.vault_bump = ctx.bumps.vault;
        ch.agent_ids = Vec::with_capacity(MAX_AGENTS);
        ch.agent_owners = Vec::with_capacity(MAX_AGENTS);
        ch.vote_counts = Vec::with_capacity(MAX_AGENTS);
        ch.agent_bet_pools = Vec::with_capacity(MAX_AGENTS);
        ch.withdrawn = Vec::with_capacity(MAX_AGENTS);

        emit!(ChallengeCreated {
            challenge_id,
            creator: ch.creator,
            entry_fee,
            start_time,
            end_time,
            judge_end,
            challenge_hash,
            competition_duration,
            refund_duration,
        });

        Ok(())
    }

    // ─── 2. ENROLL ──────────────────────────────────────────────────
    pub fn enroll(
        ctx: Context<Enroll>,
        challenge_id: [u8; 32],
        agent_id: [u8; 32],
    ) -> Result<()> {
        let ch = &mut ctx.accounts.challenge;
        let now = Clock::get()?.unix_timestamp;

        require!(now <= ch.start_time, EscrowError::EnrollmentEnded);
        require!(!ch.cancelled, EscrowError::Cancelled);
        require!(
            (ch.agent_count as usize) < MAX_AGENTS,
            EscrowError::MaxAgents
        );

        // Ensure agent_id uniqueness
        for existing in ch.agent_ids.iter() {
            require!(*existing != agent_id, EscrowError::AgentTaken);
        }

        // Transfer entry fee into vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.enrollee.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            ch.entry_fee,
        )?;

        // Push into parallel arrays
        ch.agent_ids.push(agent_id);
        ch.agent_owners.push(ctx.accounts.enrollee.key());
        ch.vote_counts.push(0);
        ch.agent_bet_pools.push(0);
        ch.withdrawn.push(false);
        ch.agent_count += 1;
        ch.total_entry_pool = ch
            .total_entry_pool
            .checked_add(ch.entry_fee)
            .ok_or(EscrowError::Overflow)?;

        let er = &mut ctx.accounts.enroll_record;
        er.bump = ctx.bumps.enroll_record;

        emit!(AgentEnrolled {
            challenge_id,
            agent_id,
            owner: ctx.accounts.enrollee.key(),
        });

        Ok(())
    }

    // ─── 3. BET ──────────────────────────────────────────────────────
    /// Place a bet on an agent. Open to everyone — no creator restriction.
    pub fn bet(
        ctx: Context<PlaceBet>,
        challenge_id: [u8; 32],
        agent_id: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let ch = &mut ctx.accounts.challenge;
        let now = Clock::get()?.unix_timestamp;

        require!(!ch.cancelled && !ch.finalized, EscrowError::NotActive);
        require!(
            now > ch.start_time && now <= ch.end_time,
            EscrowError::WrongPhase
        );
        require!(amount > 0, EscrowError::ZeroBet);

        let agent_index = ch
            .find_agent(&agent_id)
            .ok_or(error!(EscrowError::AgentNotEnrolled))?;

        require!(!ch.withdrawn[agent_index], EscrowError::AgentWithdrawn);

        // Transfer SOL into vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.bettor.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update per-user per-agent bet record
        let br = &mut ctx.accounts.bet_record;
        br.amount = br
            .amount
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;

        // Update per-user total bets
        let ut = &mut ctx.accounts.user_bet_total;
        ut.total = ut
            .total
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;

        // Update challenge-level aggregates
        ch.agent_bet_pools[agent_index] = ch.agent_bet_pools[agent_index]
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        ch.total_bet_pool = ch
            .total_bet_pool
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;

        emit!(BetPlaced {
            challenge_id,
            agent_id,
            bettor: ctx.accounts.bettor.key(),
            amount,
        });

        Ok(())
    }

    // ─── 4. VOTE ─────────────────────────────────────────────────────
    pub fn vote(
        ctx: Context<CastVote>,
        challenge_id: [u8; 32],
        agent_id: [u8; 32],
    ) -> Result<()> {
        let ch = &mut ctx.accounts.challenge;
        let now = Clock::get()?.unix_timestamp;

        require!(!ch.cancelled && !ch.finalized, EscrowError::NotActive);
        require!(ch.active_agent_count() >= MIN_AGENTS, EscrowError::TooFewAgents);
        require!(
            now > ch.end_time && now <= ch.judge_end,
            EscrowError::WrongPhase
        );

        let agent_index = ch
            .find_agent(&agent_id)
            .ok_or(error!(EscrowError::AgentNotEnrolled))?;

        require!(!ch.withdrawn[agent_index], EscrowError::AgentWithdrawn);

        // Balance gate
        let voter_lamports = ctx.accounts.voter.lamports();
        require!(
            voter_lamports >= MIN_VOTE_BALANCE,
            EscrowError::LowBalance
        );

        let vr = &mut ctx.accounts.vote_record;
        vr.bump = ctx.bumps.vote_record;

        ch.vote_counts[agent_index] = ch.vote_counts[agent_index]
            .checked_add(1)
            .ok_or(EscrowError::Overflow)?;

        emit!(VoteCast {
            challenge_id,
            agent_id,
            voter: ctx.accounts.voter.key(),
        });

        Ok(())
    }

    // ─── 5. CANCEL ───────────────────────────────────────────────────
    pub fn cancel(
        ctx: Context<CancelChallenge>,
        challenge_id: [u8; 32],
    ) -> Result<()> {
        let ch = &mut ctx.accounts.challenge;
        let now = Clock::get()?.unix_timestamp;

        require!(!ch.finalized && !ch.cancelled, EscrowError::NotActive);
        require!(now > ch.start_time, EscrowError::NotEnded);
        require!(ch.active_agent_count() < MIN_AGENTS, EscrowError::CannotCancel);

        ch.cancelled = true;

        emit!(ChallengeCancelled { challenge_id });

        Ok(())
    }

    // ─── 6. FINALIZE ─────────────────────────────────────────────────
    pub fn finalize(
        ctx: Context<Finalize>,
        challenge_id: [u8; 32],
    ) -> Result<()> {
        let ch = &mut ctx.accounts.challenge;
        let now = Clock::get()?.unix_timestamp;

        require!(!ch.finalized && !ch.cancelled, EscrowError::NotActive);
        require!(now > ch.judge_end, EscrowError::NotEnded);
        require!(ch.active_agent_count() >= MIN_AGENTS, EscrowError::TooFewAgents);

        // Determine winner: non-withdrawn agent with most votes
        let mut winner_idx: usize = 0;
        let mut max_votes: u64 = 0;
        let mut found_active = false;
        for (i, &v) in ch.vote_counts.iter().enumerate() {
            if ch.withdrawn[i] {
                continue;
            }
            if !found_active || v > max_votes {
                max_votes = v;
                winner_idx = i;
                found_active = true;
            }
        }

        ch.winner_index = winner_idx as u8;
        ch.finalized = true;

        // Compute platform fee from remaining pools
        let entry_platform = ch
            .total_entry_pool
            .checked_mul(EP)
            .ok_or(EscrowError::Overflow)?
            / 100;
        let bet_platform = ch
            .total_bet_pool
            .checked_mul(BP)
            .ok_or(EscrowError::Overflow)?
            / 100;
        let platform_fee = entry_platform
            .checked_add(bet_platform)
            .ok_or(EscrowError::Overflow)?;

        if platform_fee > 0 {
            let vault_balance = ctx.accounts.vault.lamports();
            require!(
                vault_balance >= platform_fee,
                EscrowError::InsufficientVault
            );

            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
            **ctx.accounts.platform.to_account_info().try_borrow_mut_lamports()? += platform_fee;
        }

        let winner_agent_id = ch.agent_ids[winner_idx];
        let winner_owner = ch.agent_owners[winner_idx];

        emit!(ChallengeFinalized {
            challenge_id,
            winner_agent_id,
            winner_owner,
            platform_fee,
        });

        Ok(())
    }

    // ─── 7. CLAIM ────────────────────────────────────────────────────
    /// Handles both finalized payouts and cancellation refunds.
    pub fn claim(
        ctx: Context<Claim>,
        challenge_id: [u8; 32],
    ) -> Result<()> {
        let ch = &ctx.accounts.challenge;

        require!(
            ch.finalized || ch.cancelled,
            EscrowError::NotDone
        );

        let cr = &mut ctx.accounts.claim_record;
        cr.bump = ctx.bumps.claim_record;

        let claimant = ctx.accounts.claimant.key();
        let mut payout: u64 = 0;

        if ch.cancelled {
            // Refund entry fee if enrolled (and not already withdrawn)
            if ctx.accounts.enroll_record.is_some() {
                payout = payout
                    .checked_add(ch.entry_fee)
                    .ok_or(EscrowError::Overflow)?;
            }

            // Refund all bets
            if let Some(ref ubt) = ctx.accounts.user_bet_total {
                payout = payout
                    .checked_add(ubt.total)
                    .ok_or(EscrowError::Overflow)?;
            }
        } else {
            let winner_idx = ch.winner_index as usize;
            let winner_owner = ch.agent_owners[winner_idx];

            // 1) Winner agent owner → 95% of entry pool
            if claimant == winner_owner {
                let entry_winner = ch
                    .total_entry_pool
                    .checked_mul(EW)
                    .ok_or(EscrowError::Overflow)?
                    / 100;
                payout = payout
                    .checked_add(entry_winner)
                    .ok_or(EscrowError::Overflow)?;
            }

            // 2) Creator → 4% entry + 2% bets
            if claimant == ch.creator {
                let entry_creator = ch
                    .total_entry_pool
                    .checked_mul(EC)
                    .ok_or(EscrowError::Overflow)?
                    / 100;
                let bet_creator = ch
                    .total_bet_pool
                    .checked_mul(BC)
                    .ok_or(EscrowError::Overflow)?
                    / 100;
                payout = payout
                    .checked_add(entry_creator)
                    .ok_or(EscrowError::Overflow)?
                    .checked_add(bet_creator)
                    .ok_or(EscrowError::Overflow)?;
            }

            // 3) Winning bettors → pro-rata share of 95% bet pool
            if let Some(ref wbr) = ctx.accounts.winner_bet_record {
                let user_bet_on_winner = wbr.amount;
                if user_bet_on_winner > 0 {
                    let total_winner_bets =
                        ch.agent_bet_pools[winner_idx];
                    if total_winner_bets > 0 {
                        let bet_payout_pool = ch
                            .total_bet_pool
                            .checked_mul(BW)
                            .ok_or(EscrowError::Overflow)?
                            / 100;
                        let user_share = (bet_payout_pool as u128)
                            .checked_mul(user_bet_on_winner as u128)
                            .ok_or(EscrowError::Overflow)?
                            / (total_winner_bets as u128);
                        payout = payout
                            .checked_add(user_share as u64)
                            .ok_or(EscrowError::Overflow)?;
                    }
                }
            }
        }

        require!(payout > 0, EscrowError::NoPayout);

        let vault_balance = ctx.accounts.vault.lamports();
        require!(
            vault_balance >= payout,
            EscrowError::InsufficientVault
        );

        **ctx
            .accounts
            .vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= payout;
        **ctx
            .accounts
            .claimant
            .to_account_info()
            .try_borrow_mut_lamports()? += payout;

        emit!(PayoutClaimed {
            challenge_id,
            claimant,
            amount: payout,
        });

        Ok(())
    }

    // ─── 8. WITHDRAW ─────────────────────────────────────────────────
    /// Allows an enrolled agent to withdraw from a challenge.
    /// Refunds 98% of the entry fee to the caller.
    /// Sends the 2% peek fee directly to the platform address.
    pub fn withdraw(
        ctx: Context<Withdraw>,
        challenge_id: [u8; 32],
        agent_id: [u8; 32],
    ) -> Result<()> {
        let ch = &mut ctx.accounts.challenge;
        let now = Clock::get()?.unix_timestamp;

        require!(!ch.finalized && !ch.cancelled, EscrowError::NotActive);
        require!(now > ch.start_time, EscrowError::WrongPhase);
        require!(now <= ch.end_time, EscrowError::WrongPhase);

        let agent_index = ch
            .find_agent(&agent_id)
            .ok_or(error!(EscrowError::AgentNotEnrolled))?;

        require!(!ch.withdrawn[agent_index], EscrowError::AlreadyWithdrawn);

        // Verify caller is the agent owner
        require!(
            ctx.accounts.caller.key() == ch.agent_owners[agent_index],
            EscrowError::NotAgentOwner
        );

        // Mark as withdrawn
        ch.withdrawn[agent_index] = true;

        // Compute refund and peek fee
        let refund_amount = ch
            .entry_fee
            .checked_mul(REFUND_PCT)
            .ok_or(EscrowError::Overflow)?
            / 100;
        let peek_fee = ch
            .entry_fee
            .checked_mul(PEEK_FEE_PCT)
            .ok_or(EscrowError::Overflow)?
            / 100;

        // Verify vault has enough
        let total_withdraw = refund_amount
            .checked_add(peek_fee)
            .ok_or(EscrowError::Overflow)?;
        let vault_balance = ctx.accounts.vault.lamports();
        require!(
            vault_balance >= total_withdraw,
            EscrowError::InsufficientVault
        );

        // Transfer refund to caller
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= total_withdraw;
        **ctx.accounts.caller.to_account_info().try_borrow_mut_lamports()? += refund_amount;

        // Transfer peek fee to platform
        **ctx.accounts.platform.to_account_info().try_borrow_mut_lamports()? += peek_fee;

        // Decrement total_entry_pool by full entry fee
        ch.total_entry_pool = ch
            .total_entry_pool
            .checked_sub(ch.entry_fee)
            .ok_or(EscrowError::Overflow)?;

        emit!(AgentWithdrawnEvent {
            challenge_id,
            agent_id,
            owner: ctx.accounts.caller.key(),
            refund_amount,
            peek_fee,
        });

        Ok(())
    }
}
