-- ============================================================================
-- Relay App - Agent Championship Database Schema
-- ============================================================================
-- This SQL file creates all tables, indexes, functions, and RLS policies
-- for the Agent Championship feature.
--
-- Prerequisites:
-- 1. The main schema (supabase-schema.sql) must be applied first
-- 2. Run this file in the Supabase SQL Editor
--
-- ============================================================================


-- ============================================================================
-- CHALLENGES TABLE
-- ============================================================================
-- Stores championship challenges with phase timestamps and fee configuration.

CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT UNIQUE NOT NULL,
    creator_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    rules TEXT,
    enroll_end TIMESTAMPTZ NOT NULL,
    compete_end TIMESTAMPTZ NOT NULL,
    judge_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'enrolling' CHECK (status IN ('enrolling', 'competing', 'judging', 'completed')),
    escrow_address TEXT,
    entry_fee_dot TEXT NOT NULL DEFAULT '0',
    total_entry_pool_dot TEXT NOT NULL DEFAULT '0',
    total_bet_pool_dot TEXT NOT NULL DEFAULT '0',
    winner_agent_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for challenge lookups
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_challenges_id ON challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);


-- ============================================================================
-- CHALLENGE AGENTS TABLE
-- ============================================================================
-- Binds a user's agent to a challenge. One agent per user per challenge.

CREATE TABLE IF NOT EXISTS challenge_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    owner_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    commit_hash TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    description TEXT,
    entry_tx_hash TEXT NOT NULL,
    entry_verified BOOLEAN DEFAULT FALSE,
    total_votes INTEGER DEFAULT 0,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, owner_wallet)
);

-- Indexes for agent lookups
CREATE INDEX IF NOT EXISTS idx_challenge_agents_challenge ON challenge_agents(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_agents_owner ON challenge_agents(owner_wallet);

-- Add FK from challenges.winner_agent_id to challenge_agents.id
ALTER TABLE challenges
    ADD CONSTRAINT fk_challenges_winner_agent
    FOREIGN KEY (winner_agent_id) REFERENCES challenge_agents(id)
    ON DELETE SET NULL;


-- ============================================================================
-- CHALLENGE BETS TABLE
-- ============================================================================
-- Records DOT bets placed during the compete phase.

CREATE TABLE IF NOT EXISTS challenge_bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    bettor_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES challenge_agents(id) ON DELETE CASCADE,
    amount_dot TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    placed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bet lookups
CREATE INDEX IF NOT EXISTS idx_challenge_bets_challenge ON challenge_bets(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_bets_bettor ON challenge_bets(bettor_wallet);
CREATE INDEX IF NOT EXISTS idx_challenge_bets_agent ON challenge_bets(agent_id);


-- ============================================================================
-- CHALLENGE VOTES TABLE
-- ============================================================================
-- Records votes during the judge phase. One vote per wallet per challenge.

CREATE TABLE IF NOT EXISTS challenge_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    voter_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES challenge_agents(id) ON DELETE CASCADE,
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, voter_wallet)
);

-- Indexes for vote lookups
CREATE INDEX IF NOT EXISTS idx_challenge_votes_challenge ON challenge_votes(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_voter ON challenge_votes(voter_wallet);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_agent ON challenge_votes(agent_id);


-- ============================================================================
-- CHALLENGE PAYOUTS TABLE
-- ============================================================================
-- Audit trail for all payouts. Designed for future smart contract migration.

CREATE TABLE IF NOT EXISTS challenge_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id TEXT NOT NULL REFERENCES challenges(challenge_id) ON DELETE CASCADE,
    recipient_wallet TEXT NOT NULL,
    amount_dot TEXT NOT NULL,
    payout_type TEXT NOT NULL CHECK (payout_type IN ('entry_prize', 'bet_winnings', 'platform_entry_fee', 'platform_bet_fee')),
    tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payout lookups
CREATE INDEX IF NOT EXISTS idx_challenge_payouts_challenge ON challenge_payouts(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_payouts_recipient ON challenge_payouts(recipient_wallet);
CREATE INDEX IF NOT EXISTS idx_challenge_payouts_status ON challenge_payouts(status);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment agent vote count
CREATE OR REPLACE FUNCTION increment_agent_votes(p_agent_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE challenge_agents
    SET total_votes = total_votes + 1
    WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all championship tables
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_payouts ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- CHALLENGES POLICIES
-- ============================================================================

-- Anyone can read challenges (public listing)
CREATE POLICY "Anyone can read challenges" ON challenges
    FOR SELECT
    USING (true);

-- Authenticated users can create challenges
CREATE POLICY "Authenticated users can create challenges" ON challenges
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND creator_wallet = auth.jwt() ->> 'wallet_address'
    );

-- Only creator can update their challenge (status transitions, winner)
CREATE POLICY "Creators can update their challenges" ON challenges
    FOR UPDATE
    USING (creator_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (creator_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- CHALLENGE AGENTS POLICIES
-- ============================================================================

-- Anyone can read enrolled agents (public - needed for code inspection)
CREATE POLICY "Anyone can read challenge agents" ON challenge_agents
    FOR SELECT
    USING (true);

-- Authenticated users can enroll their own agents
CREATE POLICY "Users can enroll agents" ON challenge_agents
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND owner_wallet = auth.jwt() ->> 'wallet_address'
    );

-- Agent owners can update their agent info
CREATE POLICY "Owners can update their agents" ON challenge_agents
    FOR UPDATE
    USING (owner_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (owner_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- CHALLENGE BETS POLICIES
-- ============================================================================

-- Anyone can read bets (public - for pool size display)
CREATE POLICY "Anyone can read challenge bets" ON challenge_bets
    FOR SELECT
    USING (true);

-- Authenticated users can place bets
CREATE POLICY "Users can place bets" ON challenge_bets
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND bettor_wallet = auth.jwt() ->> 'wallet_address'
    );


-- ============================================================================
-- CHALLENGE VOTES POLICIES
-- ============================================================================

-- Anyone can read votes (public - for standings)
CREATE POLICY "Anyone can read challenge votes" ON challenge_votes
    FOR SELECT
    USING (true);

-- Authenticated users can cast their own vote
CREATE POLICY "Users can cast votes" ON challenge_votes
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND voter_wallet = auth.jwt() ->> 'wallet_address'
    );


-- ============================================================================
-- CHALLENGE PAYOUTS POLICIES
-- ============================================================================

-- Anyone can read payouts (transparency)
CREATE POLICY "Anyone can read challenge payouts" ON challenge_payouts
    FOR SELECT
    USING (true);

-- Only server (via service role) should insert payouts, but allow creator for finalize
CREATE POLICY "Authenticated users can record payouts" ON challenge_payouts
    FOR INSERT
    WITH CHECK (auth.jwt() ->> 'wallet_address' IS NOT NULL);

-- Allow status updates on payouts
CREATE POLICY "Authenticated users can update payouts" ON challenge_payouts
    FOR UPDATE
    USING (auth.jwt() ->> 'wallet_address' IS NOT NULL);


-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_agent_votes(UUID) TO authenticated;


-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Agent Championship schema created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - challenges';
    RAISE NOTICE '  - challenge_agents';
    RAISE NOTICE '  - challenge_bets';
    RAISE NOTICE '  - challenge_votes';
    RAISE NOTICE '  - challenge_payouts';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS policies enabled on all tables.';
    RAISE NOTICE 'Helper functions created for vote counting.';
END;
$$;
