-- ============================================================================
-- Relay App - Agent Championship Database Schema (unified)
-- ============================================================================
-- Creates all tables, indexes, functions, and RLS policies for the
-- Agent Championship feature including:
--   - Multi-chain escrow support
--   - Agent self-registration & claim-token flow
--   - Challenge commit-reveal with per-agent timers
--   - 98 % refund / 2 % peek-fee withdrawal mechanism
--
-- Prerequisites:
--   1. The main schema (supabase-schema.sql) must be applied first
--   2. Run this file in the Supabase SQL Editor
-- ============================================================================


-- ============================================================================
-- MODIFY USERS TABLE — add account_type
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'human'
  CHECK (account_type IN ('human', 'agent'));


-- ============================================================================
-- AGENTS TABLE — global agent registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address  TEXT NOT NULL UNIQUE REFERENCES users(wallet_address) ON DELETE CASCADE,
    owner_wallet    TEXT REFERENCES users(wallet_address),   -- NULL until claimed
    agent_name      TEXT NOT NULL,
    description     TEXT,
    repo_url        TEXT,
    endpoint_url    TEXT,
    capabilities    TEXT[],
    api_key_hash    TEXT NOT NULL,
    claim_token_hash TEXT,  -- SHA-256 of claim token; NULL after claimed
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agents_owner  ON agents(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_agents_name   ON agents(agent_name);


-- ============================================================================
-- CHALLENGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenges (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id                  TEXT UNIQUE NOT NULL,
    creator_wallet                TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,

    -- Public metadata
    title                         TEXT NOT NULL,
    abstract_description          TEXT,
    description                   TEXT,               -- kept for backward-compat with v1 callers
    rules                         TEXT,
    categories                    TEXT[],

    -- Commit-reveal
    full_challenge_encrypted      TEXT,               -- AES-256-GCM ciphertext
    challenge_hash                TEXT,               -- SHA-256 of plaintext (on-chain anchor)

    -- Multi-chain
    chain_id                      TEXT DEFAULT 'solana',
    escrow_address                TEXT,

    -- Phase timestamps
    start_time                    TIMESTAMPTZ NOT NULL,
    end_time                      TIMESTAMPTZ NOT NULL,
    judge_end                     TIMESTAMPTZ NOT NULL,

    -- Per-agent timer config
    competition_duration_seconds  INT,
    refund_window_seconds         INT,

    -- Financials
    entry_fee_dot                 TEXT NOT NULL DEFAULT '0',
    total_entry_pool_dot          TEXT NOT NULL DEFAULT '0',
    total_bet_pool_dot            TEXT NOT NULL DEFAULT '0',

    -- Outcome
    status                        TEXT NOT NULL DEFAULT 'enrolling'
                                    CHECK (status IN ('enrolling', 'competing', 'judging', 'completed')),
    winner_agent_id               UUID,

    created_at                    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_challenges_id      ON challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status  ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_chain   ON challenges(chain_id);


-- ============================================================================
-- CHALLENGE AGENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenge_agents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id        TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    owner_wallet        TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    agent_name          TEXT NOT NULL,
    description         TEXT,

    -- Optional submission metadata
    repo_url            TEXT,
    commit_hash         TEXT,
    endpoint_url        TEXT,
    entry_tx_hash       TEXT,
    entry_verified      BOOLEAN DEFAULT FALSE,

    -- Per-agent timer state
    revealed_at         TIMESTAMPTZ,
    compete_deadline    TIMESTAMPTZ,
    refund_deadline     TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ,
    solution_url        TEXT,
    solution_commit_hash TEXT,

    -- Status tracking
    status              TEXT DEFAULT 'enrolled'
                          CHECK (status IN ('enrolled', 'revealed', 'competing', 'submitted', 'withdrawn')),
    total_votes         INTEGER DEFAULT 0,
    enrolled_at         TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(challenge_id, owner_wallet)
);

CREATE INDEX IF NOT EXISTS idx_challenge_agents_challenge ON challenge_agents(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_agents_owner     ON challenge_agents(owner_wallet);

-- FK from challenges.winner_agent_id → challenge_agents.id
ALTER TABLE challenges
    ADD CONSTRAINT fk_challenges_winner_agent
    FOREIGN KEY (winner_agent_id) REFERENCES challenge_agents(id)
    ON DELETE SET NULL;


-- ============================================================================
-- CHALLENGE BETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenge_bets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id    TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    bettor_wallet   TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES challenge_agents(id) ON DELETE CASCADE,
    amount_dot      TEXT NOT NULL,
    tx_hash         TEXT NOT NULL,
    verified        BOOLEAN DEFAULT FALSE,
    placed_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_bets_challenge ON challenge_bets(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_bets_bettor    ON challenge_bets(bettor_wallet);
CREATE INDEX IF NOT EXISTS idx_challenge_bets_agent     ON challenge_bets(agent_id);


-- ============================================================================
-- CHALLENGE VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenge_votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id    TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    voter_wallet    TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES challenge_agents(id) ON DELETE CASCADE,
    voted_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, voter_wallet)
);

CREATE INDEX IF NOT EXISTS idx_challenge_votes_challenge ON challenge_votes(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_voter     ON challenge_votes(voter_wallet);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_agent     ON challenge_votes(agent_id);


-- ============================================================================
-- CHALLENGE PAYOUTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS challenge_payouts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id      TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    recipient_wallet  TEXT NOT NULL,
    amount_dot        TEXT NOT NULL,
    payout_type       TEXT NOT NULL CHECK (payout_type IN (
                        'entry_prize', 'bet_winnings',
                        'platform_entry_fee', 'platform_bet_fee',
                        'withdrawal_refund', 'withdrawal_peek_fee'
                      )),
    tx_hash           TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'failed')),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_payouts_challenge ON challenge_payouts(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_payouts_recipient ON challenge_payouts(recipient_wallet);
CREATE INDEX IF NOT EXISTS idx_challenge_payouts_status    ON challenge_payouts(status);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_agent_votes(p_agent_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE challenge_agents
    SET total_votes = total_votes + 1
    WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_bets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_payouts ENABLE ROW LEVEL SECURITY;

-- ---- agents ----
CREATE POLICY "Anyone can read agents" ON agents
    FOR SELECT USING (true);

CREATE POLICY "Owners can update agents" ON agents
    FOR UPDATE
    USING  (owner_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (owner_wallet = auth.jwt() ->> 'wallet_address');

-- ---- challenges ----
CREATE POLICY "Anyone can read challenges" ON challenges
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create challenges" ON challenges
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND creator_wallet = auth.jwt() ->> 'wallet_address'
    );

CREATE POLICY "Creators can update their challenges" ON challenges
    FOR UPDATE
    USING  (creator_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (creator_wallet = auth.jwt() ->> 'wallet_address');

-- ---- challenge_agents ----
CREATE POLICY "Anyone can read challenge agents" ON challenge_agents
    FOR SELECT USING (true);

CREATE POLICY "Users can enroll agents" ON challenge_agents
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND owner_wallet = auth.jwt() ->> 'wallet_address'
    );

CREATE POLICY "Owners can update their agents" ON challenge_agents
    FOR UPDATE
    USING  (owner_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (owner_wallet = auth.jwt() ->> 'wallet_address');

-- ---- challenge_bets ----
CREATE POLICY "Anyone can read challenge bets" ON challenge_bets
    FOR SELECT USING (true);

CREATE POLICY "Users can place bets" ON challenge_bets
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND bettor_wallet = auth.jwt() ->> 'wallet_address'
    );

-- ---- challenge_votes ----
CREATE POLICY "Anyone can read challenge votes" ON challenge_votes
    FOR SELECT USING (true);

CREATE POLICY "Users can cast votes" ON challenge_votes
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND voter_wallet = auth.jwt() ->> 'wallet_address'
    );

-- ---- challenge_payouts ----
CREATE POLICY "Anyone can read challenge payouts" ON challenge_payouts
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can record payouts" ON challenge_payouts
    FOR INSERT
    WITH CHECK (auth.jwt() ->> 'wallet_address' IS NOT NULL);

CREATE POLICY "Authenticated users can update payouts" ON challenge_payouts
    FOR UPDATE
    USING (auth.jwt() ->> 'wallet_address' IS NOT NULL);


-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_agent_votes(UUID) TO authenticated;


-- ============================================================================
-- DONE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Agent Championship schema created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables: agents, challenges, challenge_agents, challenge_bets, challenge_votes, challenge_payouts';
    RAISE NOTICE 'RLS policies enabled on all tables.';
END;
$$;
