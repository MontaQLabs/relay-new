-- ============================================================================
-- Migration: Add Community Fields
-- ============================================================================
-- This migration adds new columns to the communities table for:
--   - description: Community description (required, at least 10 words)
--   - rules: Community rules (optional)
--   - activity_types: Array of allowed activity types (required)
--   - allow_investment: Whether investment is allowed (default true)
--
-- Run this in Supabase SQL Editor if you already have the communities table.
-- ============================================================================

-- Add description column (TEXT, required)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add rules column (TEXT, optional)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS rules TEXT;

-- Add activity_types column (TEXT array, required)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS activity_types TEXT[] DEFAULT '{}';

-- Add allow_investment column (BOOLEAN, defaults to true)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS allow_investment BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Community fields migration completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'New columns added to communities table:';
    RAISE NOTICE '  - description (TEXT)';
    RAISE NOTICE '  - rules (TEXT)';
    RAISE NOTICE '  - activity_types (TEXT[])';
    RAISE NOTICE '  - allow_investment (BOOLEAN)';
END;
$$;
