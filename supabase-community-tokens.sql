-- ============================================================================
-- Relay App - Community Tokens Schema Extension
-- ============================================================================
-- This SQL file adds support for Polkadot Asset Hub community tokens.
-- Run this AFTER the main supabase-schema.sql has been executed.
--
-- Prerequisites:
-- 1. Main schema (supabase-schema.sql) already applied
-- 2. Communities table exists
--
-- ============================================================================


-- ============================================================================
-- COMMUNITY TOKENS TABLE
-- ============================================================================
-- Stores community token configurations for Polkadot Asset Hub assets.
-- Each community can have one associated fungible token.

CREATE TABLE IF NOT EXISTS community_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to communities table
    community_id TEXT UNIQUE NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    
    -- Core asset identifiers (from assets.create)
    asset_id INTEGER NOT NULL, -- Unique numeric ID for the asset on Polkadot Asset Hub (u32)
    admin_wallet TEXT NOT NULL, -- Admin account address - can manage the asset
    min_balance TEXT NOT NULL DEFAULT '0', -- Minimum balance to hold the asset (stored as string for u128 precision)
    
    -- Token metadata (from assets.setMetadata)
    name TEXT NOT NULL, -- Token name (e.g., "Community Token")
    symbol TEXT NOT NULL, -- Token ticker symbol (e.g., "CTKN")
    decimals SMALLINT NOT NULL DEFAULT 10, -- Number of decimal places (u8, typically 10-18)
    
    -- Initial supply configuration (from assets.mint)
    initial_supply TEXT NOT NULL DEFAULT '0', -- Initial supply amount (stored as string for u128 precision)
    
    -- Team roles (from assets.setTeam) - optional, defaults to admin if not set
    issuer_wallet TEXT, -- Account that can mint new tokens
    freezer_wallet TEXT, -- Account that can freeze/thaw accounts
    
    -- Asset status
    is_frozen BOOLEAN DEFAULT FALSE, -- Whether the asset is frozen (no transfers allowed)
    total_supply TEXT NOT NULL DEFAULT '0', -- Current total supply (stored as string for u128 precision)
    
    -- Metadata for UI
    icon TEXT, -- Link to token icon stored in an online accessible place
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_community_tokens_community ON community_tokens(community_id);
CREATE INDEX IF NOT EXISTS idx_community_tokens_asset_id ON community_tokens(asset_id);
CREATE INDEX IF NOT EXISTS idx_community_tokens_admin ON community_tokens(admin_wallet);

-- Unique constraint on asset_id to ensure no duplicate Asset Hub asset IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_tokens_asset_id_unique ON community_tokens(asset_id);


-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================
-- Automatically update the updated_at timestamp when a row is modified.

CREATE OR REPLACE FUNCTION update_community_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_community_tokens_updated_at ON community_tokens;
CREATE TRIGGER trigger_community_tokens_updated_at
    BEFORE UPDATE ON community_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_community_tokens_updated_at();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- These policies control who can read/write community token data.

-- Enable RLS on community_tokens table
ALTER TABLE community_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can read community tokens (public data)
CREATE POLICY "Anyone can read community tokens" ON community_tokens
    FOR SELECT
    USING (true);

-- Only community owner can create a token for their community
CREATE POLICY "Community owners can create tokens" ON community_tokens
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'wallet_address' IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM communities 
            WHERE communities.community_id = community_tokens.community_id 
            AND communities.owner_wallet = auth.jwt() ->> 'wallet_address'
        )
    );

-- Only community owner can update their token
CREATE POLICY "Community owners can update tokens" ON community_tokens
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM communities 
            WHERE communities.community_id = community_tokens.community_id 
            AND communities.owner_wallet = auth.jwt() ->> 'wallet_address'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM communities 
            WHERE communities.community_id = community_tokens.community_id 
            AND communities.owner_wallet = auth.jwt() ->> 'wallet_address'
        )
    );

-- Only community owner can delete their token
CREATE POLICY "Community owners can delete tokens" ON community_tokens
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM communities 
            WHERE communities.community_id = community_tokens.community_id 
            AND communities.owner_wallet = auth.jwt() ->> 'wallet_address'
        )
    );


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get community token by community_id
CREATE OR REPLACE FUNCTION get_community_token(p_community_id TEXT)
RETURNS TABLE (
    id UUID,
    community_id TEXT,
    asset_id INTEGER,
    admin_wallet TEXT,
    min_balance TEXT,
    name TEXT,
    symbol TEXT,
    decimals SMALLINT,
    initial_supply TEXT,
    issuer_wallet TEXT,
    freezer_wallet TEXT,
    is_frozen BOOLEAN,
    total_supply TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id,
        ct.community_id,
        ct.asset_id,
        ct.admin_wallet,
        ct.min_balance,
        ct.name,
        ct.symbol,
        ct.decimals,
        ct.initial_supply,
        ct.issuer_wallet,
        ct.freezer_wallet,
        ct.is_frozen,
        ct.total_supply,
        ct.icon,
        ct.created_at,
        ct.updated_at
    FROM community_tokens ct
    WHERE ct.community_id = p_community_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update total supply (called after minting on-chain)
CREATE OR REPLACE FUNCTION update_token_supply(p_community_id TEXT, p_new_supply TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE community_tokens
    SET total_supply = p_new_supply
    WHERE community_id = p_community_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle token frozen status
CREATE OR REPLACE FUNCTION set_token_frozen(p_community_id TEXT, p_is_frozen BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE community_tokens
    SET is_frozen = p_is_frozen
    WHERE community_id = p_community_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_community_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_token_supply(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_token_frozen(TEXT, BOOLEAN) TO authenticated;


-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Community tokens schema extension created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Table created:';
    RAISE NOTICE '  - community_tokens';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS policies enabled.';
    RAISE NOTICE 'Helper functions created:';
    RAISE NOTICE '  - get_community_token(community_id)';
    RAISE NOTICE '  - update_token_supply(community_id, new_supply)';
    RAISE NOTICE '  - set_token_frozen(community_id, is_frozen)';
    RAISE NOTICE '';
    RAISE NOTICE 'This table stores Polkadot Asset Hub token configurations.';
    RAISE NOTICE 'Each community can have one associated fungible token.';
END;
$$;