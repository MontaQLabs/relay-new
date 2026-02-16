# Supabase Integration Setup Guide

This guide explains how to set up Supabase for the Relay app, including database configuration, authentication, and environment variables.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create Supabase Project](#step-1-create-supabase-project)
4. [Step 2: Get API Keys](#step-2-get-api-keys)
5. [Step 3: Configure Environment Variables](#step-3-configure-environment-variables)
6. [Step 4: Run Database Schema](#step-4-run-database-schema)
7. [Step 5: Install Dependencies](#step-5-install-dependencies)
8. [Step 6: Test Authentication](#step-6-test-authentication)
9. [Architecture Overview](#architecture-overview)
10. [API Reference](#api-reference)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Relay app uses Supabase as its backend database with wallet-based authentication. Instead of traditional email/password login, users authenticate by signing a message with their Polkadot wallet, proving ownership without exposing their private key.

### Key Features

- **Wallet-based Authentication**: Users sign a message to prove wallet ownership
- **Row Level Security (RLS)**: Data access is controlled based on wallet address
- **Real-time Subscriptions**: Live updates for activities and comments
- **Secure JWT Tokens**: Custom JWTs for Supabase authentication

---

## Prerequisites

Before starting, ensure you have:

- [ ] A Supabase account (free tier is sufficient)
- [ ] Node.js 18+ installed
- [ ] The Relay app codebase cloned and working locally

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `relay` (or your preferred name)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose the closest to your users
4. Click **"Create new project"**
5. Wait 2-3 minutes for the project to be provisioned

---

## Step 2: Get API Keys

Once your project is ready:

1. Go to **Settings** (gear icon) → **API**
2. Note down these values:

| Key | Description | Where to find |
|-----|-------------|---------------|
| **Project URL** | Your Supabase API endpoint | Under "Project URL" |
| **anon/public key** | Safe to expose in frontend | Under "Project API keys" → `anon` `public` |
| **service_role key** | **SECRET** - server only | Under "Project API keys" → `service_role` |
| **JWT Secret** | For signing tokens | Under "JWT Settings" → `JWT Secret` |

⚠️ **IMPORTANT**: Never expose the `service_role` key or `JWT Secret` in frontend code!

---

## Step 3: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Create the file
touch .env.local
```

Add the following variables:

```env
# Supabase Configuration
# ======================

# Public keys (safe for client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Private keys (server-side only - NEVER expose these!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard
```

Replace the placeholder values with your actual keys from Step 2.

### Verifying Environment Variables

The keys should look like this:

- **URL**: `https://abcdefghij.supabase.co` (about 30 chars)
- **anon key**: `eyJhbGciOiJI...` (about 200+ chars, starts with `eyJ`)
- **service_role key**: `eyJhbGciOiJI...` (about 200+ chars, starts with `eyJ`)
- **JWT Secret**: A long random string (about 40+ chars)

---

## Step 4: Run Database Schema

1. Go to your Supabase dashboard
2. Click **SQL Editor** in the sidebar
3. Click **"New query"**
4. Open the file `supabase-schema.sql` from this project
5. Copy the entire contents
6. Paste into the SQL Editor
7. Click **"Run"** (or press Cmd/Ctrl + Enter)

You should see a success message:

```
✅ Relay database schema created successfully!

Tables created:
  - users
  - auth_nonces
  - friends
  - transactions
  - communities
  - community_members
  - activities
  - activity_attendees
  - comments

RLS policies enabled on all tables.
```

### Step 4b: Run Community Tokens Schema (Optional)

If you want to enable community tokens on Polkadot Asset Hub:

1. Open the file `supabase-community-tokens.sql` from this project
2. Copy the entire contents
3. Paste into a new SQL Editor query
4. Click **"Run"**

You should see:

```
✅ Community tokens schema extension created successfully!

Table created:
  - community_tokens

This table stores Polkadot Asset Hub token configurations.
Each community can have one associated fungible token.
```

### Step 4c: Run Known Assets Schema (Required for Wallet Bazaar)

To enable the Polkadot Bazaar feature in the wallet page:

1. Run the following SQL in a new SQL Editor query:

```sql
-- ============================================================================
-- KNOWN ASSETS TABLE
-- ============================================================================
-- Stores known/popular assets on Polkadot Asset Hub for the Bazaar feature.
-- These are displayed in the wallet page for users to browse.
-- Reference: https://assethub-polkadot.subscan.io/assets

CREATE TABLE IF NOT EXISTS known_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id INTEGER UNIQUE NOT NULL,
    ticker TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 10,
    symbol TEXT NOT NULL, -- URL to the token icon
    category TEXT, -- Optional: stablecoin, meme, utility, bridged
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_known_assets_id ON known_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_known_assets_category ON known_assets(category);

-- Enable RLS
ALTER TABLE known_assets ENABLE ROW LEVEL SECURITY;

-- Anyone can read known assets (public data)
CREATE POLICY "Anyone can read known assets" ON known_assets
    FOR SELECT
    USING (true);

-- Insert initial known assets
INSERT INTO known_assets (asset_id, ticker, decimals, symbol, category) VALUES
  -- Stablecoins
  (1984, 'USDt', 6, 'https://assets.coingecko.com/coins/images/325/small/Tether.png', 'stablecoin'),
  (1337, 'USDC', 6, 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', 'stablecoin'),
  
  -- Popular meme/community tokens
  (30, 'DED', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/DED-LOGO-EYE.png', 'meme'),
  (18, 'DOTA', 4, 'https://raw.githubusercontent.com/nicpick/logos/main/dota.png', 'meme'),
  (23, 'PINK', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/pink.png', 'meme'),
  (31337, 'WUD', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/WUD.png', 'meme'),
  (17, 'WIFD', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/wifd.png', 'meme'),
  (42069, 'STINK', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/stink.png', 'meme'),
  
  -- Utility/project tokens
  (1107, 'TSN', 18, 'https://raw.githubusercontent.com/nicpick/logos/main/tsn.png', 'utility'),
  (50000111, 'DON', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/don.png', 'utility'),
  
  -- Bridged/wrapped assets
  (21, 'vDOT', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/vdot.png', 'bridged'),
  (8, 'RMRK', 10, 'https://assets.coingecko.com/coins/images/15320/small/RMRK.png', 'bridged')
ON CONFLICT (asset_id) DO UPDATE SET
  ticker = EXCLUDED.ticker,
  decimals = EXCLUDED.decimals,
  symbol = EXCLUDED.symbol,
  category = EXCLUDED.category,
  updated_at = NOW();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Known assets table created successfully!';
    RAISE NOTICE 'Table created: known_assets';
    RAISE NOTICE 'Initial assets inserted: 12 popular Polkadot Asset Hub tokens';
END;
$$;
```

2. Click **"Run"**

You should see:

```
✅ Known assets table created successfully!
Table created: known_assets
Initial assets inserted: 12 popular Polkadot Asset Hub tokens
```

### Step 4d: Run Ecosystem Projects Schema (Required for Explore Section)

To enable the multi-chain Explore section in the wallet page:

1. Run the following SQL in a new SQL Editor query:

```sql
-- ============================================================================
-- ECOSYSTEM PROJECTS TABLE
-- ============================================================================
-- Stores curated DApps/protocols across all supported chains for the Explore
-- section. Each row represents a notable project in one of the supported
-- ecosystems (Polkadot, Base, Solana, Monad).
-- Live TVL stats are fetched at runtime from DeFiLlama using defillama_slug.

CREATE TABLE IF NOT EXISTS ecosystem_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    chain_id TEXT NOT NULL,  -- polkadot | base | solana | monad
    category TEXT NOT NULL,  -- dex, lending, nft, bridge, staking, infra, gaming
    logo_url TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL DEFAULT '',
    twitter_url TEXT,
    defillama_slug TEXT,     -- DeFiLlama protocol slug for live TVL enrichment
    featured BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ecosystem_projects_chain ON ecosystem_projects(chain_id);
CREATE INDEX IF NOT EXISTS idx_ecosystem_projects_category ON ecosystem_projects(category);
CREATE INDEX IF NOT EXISTS idx_ecosystem_projects_featured ON ecosystem_projects(featured) WHERE featured = true;

-- Enable RLS
ALTER TABLE ecosystem_projects ENABLE ROW LEVEL SECURITY;

-- Anyone can read ecosystem projects (public data)
CREATE POLICY "Anyone can read ecosystem projects" ON ecosystem_projects
    FOR SELECT
    USING (true);

-- Seed with initial curated projects across chains
INSERT INTO ecosystem_projects (name, slug, description, chain_id, category, logo_url, website_url, twitter_url, defillama_slug, featured, display_order) VALUES
  -- Polkadot ecosystem
  ('HydraDX', 'hydradx', 'Cross-chain liquidity protocol on Polkadot with an Omnipool for efficient trading.', 'polkadot', 'dex', 'https://assets.coingecko.com/coins/images/26929/small/Hydration.jpg', 'https://hydration.net', 'https://twitter.com/hydaborat_net', 'hydradx', true, 1),
  ('Bifrost', 'bifrost', 'Liquid staking protocol providing liquidity for staked assets across chains.', 'polkadot', 'staking', 'https://assets.coingecko.com/coins/images/15086/small/bnc.png', 'https://bifrost.finance', 'https://twitter.com/BifrostFinance', 'bifrost', false, 3),

  -- Base ecosystem
  ('Aerodrome', 'aerodrome', 'Central trading and liquidity marketplace on Base.', 'base', 'dex', 'https://assets.coingecko.com/coins/images/31745/small/token.png', 'https://aerodrome.finance', 'https://twitter.com/AeurodromeFinance', 'aerodrome-finance', true, 1),
  ('Aave (Base)', 'aave-base', 'Leading decentralized lending and borrowing protocol, deployed on Base.', 'base', 'lending', 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png', 'https://aave.com', 'https://twitter.com/aaborave', 'aave', false, 2),
  ('Uniswap (Base)', 'uniswap-base', 'The largest decentralized exchange, available on Base for low-cost swaps.', 'base', 'dex', 'https://assets.coingecko.com/coins/images/12504/small/uniswap.png', 'https://app.uniswap.org', 'https://twitter.com/Uniswap', 'uniswap', false, 3),
  ('Extra Finance', 'extra-finance', 'Leveraged yield farming and lending protocol on Base.', 'base', 'lending', 'https://assets.coingecko.com/coins/images/30526/small/extra.png', 'https://extra.finance', 'https://twitter.com/ExtraFi_io', 'extra-finance', false, 4),
  ('Morpho (Base)', 'morpho-base', 'Permissionless lending protocol optimizing rates on Base.', 'base', 'lending', 'https://assets.coingecko.com/coins/images/29837/small/morpho.png', 'https://morpho.org', 'https://twitter.com/MorphoLabs', 'morpho', false, 5),

  -- Solana ecosystem
  ('Jupiter', 'jupiter', 'Leading DEX aggregator on Solana with limit orders and DCA.', 'solana', 'dex', 'https://assets.coingecko.com/coins/images/35118/small/JUP.png', 'https://jup.ag', 'https://twitter.com/JupiterExchange', 'jupiter', true, 1),
  ('Marinade Finance', 'marinade', 'Liquid staking protocol for SOL with mSOL derivative.', 'solana', 'staking', 'https://assets.coingecko.com/coins/images/18867/small/marinade.png', 'https://marinade.finance', 'https://twitter.com/MarinadeFinance', 'marinade-finance', false, 2),
  ('Raydium', 'raydium', 'Automated market maker and liquidity provider on Solana.', 'solana', 'dex', 'https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg', 'https://raydium.io', 'https://twitter.com/RaydiumProtocol', 'raydium', false, 3),
  ('Drift', 'drift', 'Decentralized perpetual futures and spot exchange on Solana.', 'solana', 'dex', 'https://assets.coingecko.com/coins/images/36578/small/drift.png', 'https://drift.trade', 'https://twitter.com/DriftProtocol', 'drift', false, 4),
  ('Tensor', 'tensor', 'Professional-grade NFT marketplace and aggregator on Solana.', 'solana', 'nft', 'https://assets.coingecko.com/coins/images/35141/small/tensor.png', 'https://tensor.trade', 'https://twitter.com/tensor_hq', NULL, false, 5),

  -- Monad ecosystem (emerging)
  ('Monad DEX', 'monad-dex', 'Native decentralized exchange built for Monad high-throughput EVM.', 'monad', 'dex', '', 'https://monad.xyz', 'https://twitter.com/moabornad_xyz', NULL, true, 1),
  ('Monad Bridge', 'monad-bridge', 'Official bridge for moving assets to and from Monad.', 'monad', 'bridge', '', 'https://monad.xyz', 'https://twitter.com/moabornad_xyz', NULL, false, 2)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  chain_id = EXCLUDED.chain_id,
  category = EXCLUDED.category,
  logo_url = EXCLUDED.logo_url,
  website_url = EXCLUDED.website_url,
  twitter_url = EXCLUDED.twitter_url,
  defillama_slug = EXCLUDED.defillama_slug,
  featured = EXCLUDED.featured,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Ecosystem projects table created successfully!';
    RAISE NOTICE 'Table created: ecosystem_projects';
    RAISE NOTICE 'Initial projects inserted: 17 curated DApps across 4 chains';
END;
$$;
```

2. Click **"Run"**

You should see:

```
✅ Ecosystem projects table created successfully!
Table created: ecosystem_projects
Initial projects inserted: 17 curated DApps across 4 chains
```

### Verify Tables

1. Go to **Table Editor** in the sidebar
2. You should see all 9 tables listed (10 with community_tokens, 11 with known_assets, 12 with ecosystem_projects)
3. Click on each table to verify the columns are correct

---

## Step 5: Install Dependencies

Install the required npm packages:

```bash
npm install @supabase/supabase-js jose
```

These packages provide:
- `@supabase/supabase-js`: Supabase client for database operations
- `jose`: JWT library for creating authentication tokens (Edge-compatible)

---

## Step 6: Test Authentication

### Start the Development Server

```bash
npm run dev
```

### Test the Auth Flow

1. Create or import a wallet in the app
2. The app should automatically authenticate with Supabase
3. Check the browser console for any errors

### Verify in Supabase

1. Go to **Table Editor** → **users**
2. You should see a new row with your wallet address
3. Check **auth_nonces** - it should be empty (nonces are deleted after use)

---

## Architecture Overview

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. User wants to authenticate                                   │
│     └─> Call authenticateWithWallet() from auth.ts               │
│                                                                   │
│  2. Get wallet address from stored mnemonic                      │
│     └─> Uses @polkadot/keyring                                   │
│                                                                   │
│  3. Request nonce from server                                    │
│     └─> POST /api/auth/nonce { walletAddress }                   │
│     └─> Server stores nonce in auth_nonces table (5 min expiry)  │
│     └─> Returns { message, nonce }                               │
│                                                                   │
│  4. Sign the message with wallet                                 │
│     └─> Uses keypair.sign(message)                               │
│     └─> Creates cryptographic proof of wallet ownership          │
│                                                                   │
│  5. Verify signature and get JWT                                 │
│     └─> POST /api/auth/verify { walletAddress, signature, nonce }│
│     └─> Server verifies signature using @polkadot/util-crypto    │
│     └─> Server creates/updates user in users table               │
│     └─> Server generates JWT with wallet_address claim           │
│     └─> Returns { token }                                        │
│                                                                   │
│  6. Set JWT in Supabase client                                   │
│     └─> supabase.auth.setSession({ access_token: token })        │
│     └─> All subsequent requests include the JWT                  │
│                                                                   │
│  7. RLS policies check JWT for wallet_address                    │
│     └─> auth.jwt() ->> 'wallet_address' in SQL policies          │
│     └─> Users can only access their own data                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
app/
├── api/
│   └── auth/
│       ├── nonce/
│       │   └── route.ts      # Generates authentication nonce
│       └── verify/
│           └── route.ts      # Verifies signature, issues JWT
├── db/
│   └── supabase.ts           # All database operations
├── utils/
│   └── auth.ts               # Client-side auth utilities
└── types/
    └── frontend_type.ts      # TypeScript types
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────>│   Next.js    │────>│   Supabase   │
│  Components  │     │  API Routes  │     │   Database   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  supabase.ts │     │  auth.ts     │     │  RLS Policies│
│  (queries)   │     │  (server)    │     │  (security)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## API Reference

### Authentication Functions (auth.ts)

| Function | Description |
|----------|-------------|
| `authenticateWithWallet(mnemonic?)` | Full auth flow, returns JWT |
| `isAuthenticated()` | Check if user has valid session |
| `getAuthenticatedWallet()` | Get current wallet address |
| `signOut()` | Clear authentication session |
| `restoreSession()` | Restore session from stored token |

### Database Operations (supabase.ts)

#### Users
| Function | Description |
|----------|-------------|
| `getCurrentUser()` | Get authenticated user's full profile |
| `getUserByWallet(address)` | Get any user by wallet address |
| `updateUserProfile(address, updates)` | Update avatar/nickname |

#### Friends
| Function | Description |
|----------|-------------|
| `getFriends(walletAddress)` | Get user's friend list |
| `addFriend(userWallet, friend)` | Add a new friend |
| `updateFriend(userWallet, friendAddress, updates)` | Update friend info |
| `removeFriend(userWallet, friendAddress)` | Remove a friend |

#### Communities
| Function | Description |
|----------|-------------|
| `getAllCommunities()` | Get all public communities |
| `getUserCommunities(walletAddress)` | Get communities user belongs to |
| `getCommunity(communityId)` | Get single community by ID |
| `createCommunity(ownerWallet, data)` | Create new community (name, description, activityTypes, etc.) |
| `updateCommunity(communityId, updates)` | Update community (owner only) |
| `deleteCommunity(communityId)` | Delete community (owner only) |
| `joinCommunity(communityId, userWallet)` | Join a community |
| `leaveCommunity(communityId, userWallet)` | Leave a community |

**Community Fields:**
- `name` - Community name (required)
- `description` - Community description, at least 10 words (required)
- `avatar` - Link to community avatar image (optional)
- `rules` - Community rules for members (optional)
- `activityTypes` - Array of allowed activity types (required)
- `allowInvestment` - Whether investment is allowed (default: true)

#### Activities
| Function | Description |
|----------|-------------|
| `getCommunityActivities(communityId)` | Get activities in a community |
| `getUserActivities(walletAddress)` | Get user's activities |
| `getActivity(activityId)` | Get single activity by ID |
| `createActivity(ownerWallet, data)` | Create new activity |
| `updateActivity(activityId, updates)` | Update activity (owner only) |
| `deleteActivity(activityId)` | Delete activity (owner only) |
| `joinActivity(activityId, userWallet)` | Join an activity |
| `leaveActivity(activityId, userWallet)` | Leave an activity |
| `likeActivity(activityId)` | Like an activity |

#### Comments
| Function | Description |
|----------|-------------|
| `getActivityComments(activityId)` | Get comments on activity |
| `getComment(commentId)` | Get single comment by ID |
| `createComment(publisherWallet, activityId, content)` | Create comment |
| `updateComment(commentId, content)` | Update comment (publisher only) |
| `deleteComment(commentId)` | Delete comment (publisher only) |
| `likeComment(commentId)` | Like a comment |

#### Subscriptions (Real-time)
| Function | Description |
|----------|-------------|
| `subscribeToActivities(communityId, callback)` | Live activity updates |
| `subscribeToComments(activityId, callback)` | Live comment updates |
| `unsubscribe(subscription)` | Unsubscribe from channel |

#### Community Tokens (Polkadot Asset Hub)
| Function | Description |
|----------|-------------|
| `getCommunityToken(communityId)` | Get token config for a community |
| `createCommunityToken(communityId, tokenData)` | Create token record (owner only) |
| `updateCommunityToken(communityId, updates)` | Update token config (owner only) |
| `deleteCommunityToken(communityId)` | Delete token record (owner only) |
| `updateTokenSupply(communityId, newSupply)` | Update total supply after minting |
| `setTokenFrozen(communityId, isFrozen)` | Toggle token frozen status |

#### Known Assets (Polkadot Asset Hub Bazaar)
| Function | Description |
|----------|-------------|
| `getKnownAssets()` | Get all known assets for the Bazaar |
| `getKnownAssetById(assetId)` | Get a specific known asset by ID |
| `getKnownAssetsByCategory(category)` | Get assets filtered by category |

**KnownAsset Fields:**
- `id` - Unique numeric asset ID on Polkadot Asset Hub (u32)
- `ticker` - Token ticker symbol (e.g., "USDt", "USDC", "DED")
- `decimals` - Number of decimal places (typically 6-18)
- `symbol` - URL to the token icon/logo
- `category` - Optional category: "stablecoin", "meme", "utility", "bridged"

#### Ecosystem Projects (Multi-chain Explore)
| Function | Description |
|----------|-------------|
| `getEcosystemProjects()` | Get all curated DApps/protocols ordered by display_order |
| `getEcosystemProjectsByChain(chainId)` | Get projects filtered by chain (polkadot, base, solana, monad) |
| `getFeaturedProjects()` | Get featured projects only |

**EcosystemProject Fields:**
- `id` - UUID primary key
- `name` - Project name (e.g., "Jupiter", "Uniswap")
- `slug` - URL-safe unique identifier
- `description` - Short description of the project
- `chainId` - Chain identifier: "polkadot", "base", "solana", "monad"
- `category` - Project category: "dex", "lending", "nft", "bridge", "staking", "infra", "gaming"
- `logoUrl` - URL to the project logo
- `websiteUrl` - Project website URL
- `twitterUrl` - Optional Twitter/X URL
- `defillamaSlug` - Optional DeFiLlama slug for live TVL enrichment
- `featured` - Whether the project is highlighted

---

## Troubleshooting

### Common Errors

#### "Wallet address is required"
- **Cause**: Calling auth without a wallet
- **Fix**: Ensure user has created/imported a wallet first

#### "Invalid or expired nonce"
- **Cause**: Nonce expired (>5 min) or already used
- **Fix**: Request a new nonce and try again

#### "Invalid signature"
- **Cause**: Message was modified or wrong key used
- **Fix**: Ensure the exact message from server is signed

#### "Permission denied for table..."
- **Cause**: RLS policy blocking access
- **Fix**: Check that JWT contains correct `wallet_address`

#### "JWT expired"
- **Cause**: Token older than 24 hours
- **Fix**: Call `refreshAuth()` to get new token

### Debugging Tips

1. **Check browser console** for detailed error messages

2. **Verify environment variables**:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   ```

3. **Check Supabase logs**:
   - Go to Dashboard → Logs → Postgres
   - Look for failed queries

4. **Test RLS policies**:
   - Go to SQL Editor
   - Run: `SELECT auth.jwt()` (shows current JWT claims)

5. **View table data**:
   - Use Table Editor with RLS disabled (gear icon)
   - Or use SQL: `SELECT * FROM users;`

### Reset Database

If you need to start fresh:

1. Go to SQL Editor
2. Uncomment the DROP statements at the top of `supabase-schema.sql`
3. Run the drops
4. Re-run the full schema

---

## Security Considerations

1. **Never expose service role key** - It bypasses all RLS policies
2. **JWT Secret must be secret** - Anyone with it can forge tokens
3. **Nonces are one-time use** - Prevents replay attacks
4. **Signatures prove ownership** - No password needed
5. **RLS enforces access control** - Even if client is compromised

---

## Next Steps

After setup is complete:

1. [ ] Test creating a community
2. [ ] Test creating an activity
3. [ ] Test adding comments
4. [ ] Test real-time subscriptions
5. [ ] Integrate with existing UI components

For questions or issues, check the Supabase documentation at [supabase.com/docs](https://supabase.com/docs).
