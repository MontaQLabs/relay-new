-- ============================================================================
-- Relay App - Supabase Database Schema
-- ============================================================================
-- This SQL file creates all necessary tables, indexes, functions, and RLS 
-- policies for the Relay application.
--
-- Prerequisites:
-- 1. Create a Supabase project at https://supabase.com
-- 2. Go to SQL Editor in the Supabase dashboard
-- 3. Paste this entire file and run it
--
-- ============================================================================


-- ============================================================================
-- CLEANUP (Optional - uncomment if you need to reset)
-- ============================================================================
-- DROP TABLE IF EXISTS auth_nonces CASCADE;
-- DROP TABLE IF EXISTS comments CASCADE;
-- DROP TABLE IF EXISTS activity_attendees CASCADE;
-- DROP TABLE IF EXISTS activities CASCADE;
-- DROP TABLE IF EXISTS community_members CASCADE;
-- DROP TABLE IF EXISTS communities CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS friends CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP FUNCTION IF EXISTS increment_activity_likes CASCADE;
-- DROP FUNCTION IF EXISTS increment_comment_likes CASCADE;


-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user profiles. Each user is identified by their wallet address.

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    avatar TEXT,
    nickname TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Index for faster lookups by wallet address
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);


-- ============================================================================
-- AUTH NONCES TABLE
-- ============================================================================
-- Stores one-time nonces for wallet authentication.
-- Nonces expire after 5 minutes and are deleted after use.

CREATE TABLE IF NOT EXISTS auth_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    nonce TEXT NOT NULL,
    message TEXT, -- The exact message to be signed (includes timestamp)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for faster nonce lookups
CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON auth_nonces(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON auth_nonces(expires_at);

-- Automatic cleanup of expired nonces (runs periodically via pg_cron if enabled)
-- You can also manually delete expired nonces with:
-- DELETE FROM auth_nonces WHERE expires_at < NOW();


-- ============================================================================
-- FRIENDS TABLE
-- ============================================================================
-- Stores user's contact list (friends).
-- Each user can have multiple friends, stored as wallet addresses.

CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    network TEXT NOT NULL DEFAULT 'Polkadot Asset Hub',
    remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_wallet, wallet_address)
);

-- Index for faster friend lookups
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_wallet);


-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
-- Records of blockchain transactions (for display purposes).
-- Actual transactions happen on-chain; this is a record for the UI.

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_id TEXT UNIQUE NOT NULL,
    sender_wallet TEXT NOT NULL,
    sender_nickname TEXT,
    receiver_wallet TEXT NOT NULL,
    receiver_nickname TEXT,
    network TEXT NOT NULL DEFAULT 'Polkadot Asset Hub',
    amount_fiat DECIMAL(20, 2) NOT NULL,
    fees_fiat DECIMAL(20, 8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);


-- ============================================================================
-- COMMUNITIES TABLE
-- ============================================================================
-- User-created communities for activities.

CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT UNIQUE NOT NULL,
    owner_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    rules TEXT,
    activity_types TEXT[] DEFAULT '{}',
    allow_investment BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for community lookups
CREATE INDEX IF NOT EXISTS idx_communities_owner ON communities(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_communities_id ON communities(community_id);


-- ============================================================================
-- COMMUNITY MEMBERS TABLE
-- ============================================================================
-- Junction table for users who are members of communities.

CREATE TABLE IF NOT EXISTS community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    user_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id, user_wallet)
);

-- Indexes for member lookups
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_wallet);


-- ============================================================================
-- ACTIVITIES TABLE
-- ============================================================================
-- Events/activities within communities.

CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id TEXT UNIQUE NOT NULL,
    community_id TEXT NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    owner_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_paid BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    max_attendees INTEGER NOT NULL DEFAULT 0,
    pictures TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'finished', 'cancelled')),
    currency TEXT,
    amount DECIMAL(20, 2),
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activity lookups
CREATE INDEX IF NOT EXISTS idx_activities_community ON activities(community_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_activities_id ON activities(activity_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);


-- ============================================================================
-- ACTIVITY ATTENDEES TABLE
-- ============================================================================
-- Junction table for users attending activities.

CREATE TABLE IF NOT EXISTS activity_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id TEXT NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    user_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(activity_id, user_wallet)
);

-- Indexes for attendee lookups
CREATE INDEX IF NOT EXISTS idx_activity_attendees_activity ON activity_attendees(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attendees_user ON activity_attendees(user_wallet);


-- ============================================================================
-- COMMENTS TABLE
-- ============================================================================
-- Comments on activities.

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id TEXT UNIQUE NOT NULL,
    activity_id TEXT NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    publisher_wallet TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comment lookups
CREATE INDEX IF NOT EXISTS idx_comments_activity ON comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_comments_publisher ON comments(publisher_wallet);
CREATE INDEX IF NOT EXISTS idx_comments_id ON comments(comment_id);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment activity likes
CREATE OR REPLACE FUNCTION increment_activity_likes(p_activity_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE activities
    SET likes = likes + 1
    WHERE activity_id = p_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment comment likes
CREATE OR REPLACE FUNCTION increment_comment_likes(p_comment_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE comments
    SET likes = likes + 1
    WHERE comment_id = p_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- These policies control who can read/write data based on their wallet address.
-- The wallet_address is extracted from the JWT token.

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- AUTH NONCES POLICIES (Server-only via service role)
-- ============================================================================
-- No public access - managed by server with service role key


-- ============================================================================
-- USERS POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (wallet_address = auth.jwt() ->> 'wallet_address')
    WITH CHECK (wallet_address = auth.jwt() ->> 'wallet_address');

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can create own profile" ON users
    FOR INSERT
    WITH CHECK (wallet_address = auth.jwt() ->> 'wallet_address');

-- Allow reading public user info (nickname, avatar) for display
CREATE POLICY "Anyone can read public user info" ON users
    FOR SELECT
    USING (true);


-- ============================================================================
-- FRIENDS POLICIES
-- ============================================================================

-- Users can read their own friends
CREATE POLICY "Users can read own friends" ON friends
    FOR SELECT
    USING (user_wallet = auth.jwt() ->> 'wallet_address');

-- Users can add friends to their own list
CREATE POLICY "Users can add friends" ON friends
    FOR INSERT
    WITH CHECK (user_wallet = auth.jwt() ->> 'wallet_address');

-- Users can update their own friends
CREATE POLICY "Users can update own friends" ON friends
    FOR UPDATE
    USING (user_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (user_wallet = auth.jwt() ->> 'wallet_address');

-- Users can delete their own friends
CREATE POLICY "Users can delete own friends" ON friends
    FOR DELETE
    USING (user_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- TRANSACTIONS POLICIES
-- ============================================================================

-- Users can read transactions they're involved in
CREATE POLICY "Users can read own transactions" ON transactions
    FOR SELECT
    USING (
        sender_wallet = auth.jwt() ->> 'wallet_address' 
        OR receiver_wallet = auth.jwt() ->> 'wallet_address'
    );

-- Users can insert transactions where they are the sender
CREATE POLICY "Users can record transactions as sender" ON transactions
    FOR INSERT
    WITH CHECK (sender_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- COMMUNITIES POLICIES
-- ============================================================================

-- Anyone can read communities (public)
CREATE POLICY "Anyone can read communities" ON communities
    FOR SELECT
    USING (true);

-- Authenticated users can create communities
CREATE POLICY "Authenticated users can create communities" ON communities
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND owner_wallet = auth.jwt() ->> 'wallet_address'
    );

-- Only owner can update their community
CREATE POLICY "Owners can update their communities" ON communities
    FOR UPDATE
    USING (owner_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (owner_wallet = auth.jwt() ->> 'wallet_address');

-- Only owner can delete their community
CREATE POLICY "Owners can delete their communities" ON communities
    FOR DELETE
    USING (owner_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- COMMUNITY MEMBERS POLICIES
-- ============================================================================

-- Anyone can see community members (public)
CREATE POLICY "Anyone can read community members" ON community_members
    FOR SELECT
    USING (true);

-- Users can join communities (add themselves)
CREATE POLICY "Users can join communities" ON community_members
    FOR INSERT
    WITH CHECK (user_wallet = auth.jwt() ->> 'wallet_address');

-- Users can leave communities (remove themselves)
CREATE POLICY "Users can leave communities" ON community_members
    FOR DELETE
    USING (user_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- ACTIVITIES POLICIES
-- ============================================================================

-- Anyone can read activities (public)
CREATE POLICY "Anyone can read activities" ON activities
    FOR SELECT
    USING (true);

-- Authenticated users can create activities
CREATE POLICY "Authenticated users can create activities" ON activities
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND owner_wallet = auth.jwt() ->> 'wallet_address'
    );

-- Only owner can update their activity
CREATE POLICY "Owners can update their activities" ON activities
    FOR UPDATE
    USING (owner_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (owner_wallet = auth.jwt() ->> 'wallet_address');

-- Only owner can delete their activity
CREATE POLICY "Owners can delete their activities" ON activities
    FOR DELETE
    USING (owner_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- ACTIVITY ATTENDEES POLICIES
-- ============================================================================

-- Anyone can see activity attendees (public)
CREATE POLICY "Anyone can read activity attendees" ON activity_attendees
    FOR SELECT
    USING (true);

-- Users can join activities (add themselves)
CREATE POLICY "Users can join activities" ON activity_attendees
    FOR INSERT
    WITH CHECK (user_wallet = auth.jwt() ->> 'wallet_address');

-- Users can leave activities (remove themselves)
CREATE POLICY "Users can leave activities" ON activity_attendees
    FOR DELETE
    USING (user_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- COMMENTS POLICIES
-- ============================================================================

-- Anyone can read comments (public)
CREATE POLICY "Anyone can read comments" ON comments
    FOR SELECT
    USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments" ON comments
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND publisher_wallet = auth.jwt() ->> 'wallet_address'
    );

-- Only publisher can update their comment
CREATE POLICY "Publishers can update their comments" ON comments
    FOR UPDATE
    USING (publisher_wallet = auth.jwt() ->> 'wallet_address')
    WITH CHECK (publisher_wallet = auth.jwt() ->> 'wallet_address');

-- Only publisher can delete their comment
CREATE POLICY "Publishers can delete their comments" ON comments
    FOR DELETE
    USING (publisher_wallet = auth.jwt() ->> 'wallet_address');


-- ============================================================================
-- GRANT PERMISSIONS FOR RPC FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_activity_likes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_comment_likes(TEXT) TO authenticated;


-- ============================================================================
-- OPTIONAL: Cleanup job for expired nonces (if pg_cron is enabled)
-- ============================================================================
-- Uncomment if you have pg_cron extension enabled:
--
-- SELECT cron.schedule(
--     'cleanup-expired-nonces',
--     '*/5 * * * *',  -- Every 5 minutes
--     $$DELETE FROM auth_nonces WHERE expires_at < NOW()$$
-- );


-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- If you see this, the schema was created successfully!
DO $$
BEGIN
    RAISE NOTICE '✅ Relay database schema created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - users';
    RAISE NOTICE '  - auth_nonces';
    RAISE NOTICE '  - friends';
    RAISE NOTICE '  - transactions';
    RAISE NOTICE '  - communities';
    RAISE NOTICE '  - community_members';
    RAISE NOTICE '  - activities';
    RAISE NOTICE '  - activity_attendees';
    RAISE NOTICE '  - comments';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS policies enabled on all tables.';
    RAISE NOTICE 'Helper functions created for likes.';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Copy your Supabase URL, anon key, service role key, and JWT secret';
    RAISE NOTICE '  2. Add them to your .env.local file';
    RAISE NOTICE '  3. Install dependencies: npm install @supabase/supabase-js jose';
    RAISE NOTICE '  4. Test the authentication flow';
END;
$$;
