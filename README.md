# Relay - User Manual

> A Web3-powered community and wallet application built on Polkadot Asset Hub

---

## Table of Contents

1. [Introduction](#introduction)
2. [Product Architecture](#product-architecture)
3. [Feature Highlights](#feature-highlights)
4. [Prerequisites](#prerequisites)
5. [Installation Guide](#installation-guide)
6. [Configuration](#configuration)
7. [Database Setup](#database-setup)
8. [Running the Application](#running-the-application)
9. [API Reference](#api-reference)
10. [Testing](#testing)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)
13. [Security Considerations](#security-considerations)

---

## Introduction

Relay is an Web3 application that combines community management with cryptocurrency wallet functionality. Built on Next.js 16 and Polkadot Asset Hub, it enables users to:

- Create and manage crypto wallets on Polkadot Asset Hub
- Join and create communities with shared activities
- Send and receive tokens on Polkadot Asset Hub
- Create community tokens (Coming soon...)
- Authenticate securely using wallet signatures (no passwords required)

### Technology Stack

| Layer          | Technology                                                              |
| -------------- | ----------------------------------------------------------------------- |
| Frontend       | Next.js 16, React 19, TailwindCSS 4                                     |
| Backend        | Next.js API Routes (Edge-compatible)                                    |
| Database       | Supabase (PostgreSQL with RLS), only for community and activity storage |
| Blockchain     | Polkadot Asset Hub via Polkadot API                                     |
| Authentication | Wallet-based JWT (sr25519 signatures)                                   |
| Testing        | Vitest, Testing Library                                                 |

---

## Product Architecture

### Backend Clarification

┌─────────────────────────────────────────────────────────────────────────────┐
│ Web2 + Web3 SERVICES │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐ ┌───────────────────────────────┐ │
│ │ Supabase Database │ │ Polkadot Asset Hub │ │
│ │ (PostgreSQL + RLS) │ │ (Blockchain) │ │
│ │ │ │ │ │
│ │ - users │ │ - Native DOT transfers │ │
│ │ - communities │ │ - Asset Hub tokens │ │
│ │ - activities │ │ │ │
│ │ - comments │ │ │ │
│ │ - friends │ │ │ │
│ │ - transactions │ │ │ │
│ │ - community_tokens │ │ │ │
│ │ - known_assets │ │ │ │
│ └───────────────────────────┘ └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

```

### Directory Structure

```

relay-new/
├── app/ # Next.js App Router
│ ├── api/ # API Routes
│ │ ├── auth/ # Authentication endpoints
│ │ │ ├── nonce/ # Generate auth nonce
│ │ │ └── verify/ # Verify signature & issue JWT
│ │ ├── activity/ # Activity management
│ │ ├── community/ # Community CRUD operations
│ │ ├── friends/ # Friend list management
│ │ └── user/ # User profile operations
│ ├── dashboard/ # Main application pages
│ │ ├── community/ # Community views
│ │ ├── settings/ # User settings
│ │ └── wallet/ # Wallet operations
│ ├── db/ # Database utilities
│ │ └── supabase.ts # Supabase client & operations
│ ├── types/ # TypeScript type definitions
│ │ ├── frontend_type.ts # Domain types
│ │ └── constants.ts # App constants
│ └── utils/ # Utility functions
│ └── auth.ts # Authentication utilities
├── components/ # Reusable UI components
├── lib/ # Shared libraries
├── public/ # Static assets
├── tests/ # Test suites
├── supabase-schema.sql # Main database schema
├── supabase-community-tokens.sql # Token extension schema
└── supabase-migration-\*.sql # Migration scripts

```

### Data Flow

```

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Frontend │────▶│ Next.js │────▶│ Supabase │
│ Components │ │ API Routes │ │ Database │
└──────────────┘ └──────────────┘ └──────────────┘
│ │ │
│ │ │
▼ ▼ ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ supabase.ts │ │ auth.ts │ │ RLS Policies│
│ (queries) │ │ (server) │ │ (security) │
└──────────────┘ └──────────────┘ └──────────────┘

```

---

## Feature Highlights

### 1. Web3 Wallet Authentication (Passwordless)

Relay uses a cryptographic signature-based authentication system. Users prove ownership of their wallet by signing a message with their private key, eliminating the need for passwords.

**How it works:**

```

┌─────────────────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION FLOW │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ 1. User wants to authenticate │
│ └─▶ Call authenticateWithWallet() from auth.ts │
│ │
│ 2. Get wallet address from stored mnemonic │
│ └─▶ Uses @polkadot/keyring with sr25519 curve │
│ │
│ 3. Request nonce from server │
│ └─▶ POST /api/auth/nonce { walletAddress } │
│ └─▶ Server stores nonce in auth_nonces table (5 min expiry) │
│ └─▶ Returns { message, nonce } │
│ │
│ 4. Sign the message with wallet │
│ └─▶ Uses keypair.sign(message) with sr25519 │
│ └─▶ Creates cryptographic proof of wallet ownership │
│ │
│ 5. Verify signature and get JWT │
│ └─▶ POST /api/auth/verify { walletAddress, signature, nonce } │
│ └─▶ Server verifies using @polkadot/util-crypto signatureVerify │
│ └─▶ Server creates/updates user in users table │
│ └─▶ Server generates JWT with wallet_address claim (24h expiry) │
│ └─▶ Returns { token } │
│ │
│ 6. Set JWT in Supabase client │
│ └─▶ All subsequent requests include the JWT │
│ │
│ 7. RLS policies check JWT for wallet_address │
│ └─▶ auth.jwt() ->> 'wallet_address' in SQL policies │
│ └─▶ Users can only access their own data │
│ │
└─────────────────────────────────────────────────────────────────────────────┘

````

**Security Features:**
- **No password storage**: Authentication is based on cryptographic signatures
- **One-time nonces**: Prevents replay attacks
- **Short expiry**: Nonces expire in 5 minutes
- **JWT tokens**: Secure, stateless session management
- **RLS enforcement**: Database-level access control

### 2. Polkadot Asset Hub Integration

Relay integrates directly with Polkadot Asset Hub for blockchain operations:
- **Native DOT transfers**: Send and receive DOT tokens
- **Asset Hub tokens**: Support for USDt, USDC, and other fungible assets
- **Community tokens**: Create custom tokens for communities
- **QR code payments**: Scan to send/receive tokens

### 3. Community Management

Create and manage communities with:

- **Custom activity types**: Define allowed activities (meetings, events, etc.)
- **Member management**: Join/leave communities
- **Community tokens**: Issue fungible tokens on Polkadot Asset Hub
- **Activity scheduling**: Create and manage events
- **Real-time updates** (needs fine-tune): Live activity and comment subscriptions

### 4. Social Features

- **Friends list**: Manage contacts with wallet addresses
- **Activity comments**: Discuss activities with community members
- **Like system**: Engage with activities and comments
- **Transaction history**: Track all wallet transactions

### 5. Polkadot Bazaar

Browse known tokens on Polkadot Asset Hub:
- Stablecoins (USDt, USDC)
- Utility tokens
- Bridged assets

---

## Prerequisites

Before installation, ensure you have:

| Requirement | Version | Purpose |
|------------|---------|---------|
| Node.js | 18.x or higher | JavaScript runtime |
| npm | 9.x or higher | Package manager |
| Git | 2.x or higher | Version control |
| Supabase Account | Free tier OK | Database & auth |

### Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project (free tier is sufficient)

---

## Installation Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/MontaQ-Labs/relay-new.git
cd relay-new
````

### Step 2: Install Dependencies

```bash
npm install
```

This will:

- Install all npm packages
- Run `papi generate` (postinstall script) to generate Polkadot API descriptors

### Step 3: Verify Installation

```bash
# Check that dependencies are installed correctly
npm run lint
```

---

## Configuration

### Step 1: Create Supabase Project

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: `relay` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning

### Step 2: Get API Keys

Once your project is ready:

1. Go to **Settings** → **API**
2. Note down these values:

| Key                  | Description                      | Location                             |
| -------------------- | -------------------------------- | ------------------------------------ |
| **Project URL**      | Supabase API endpoint            | "Project URL" section                |
| **anon/public key**  | Client-side key (safe to expose) | "Project API keys" → `anon` `public` |
| **service_role key** | Server-side key (**SECRET**)     | "Project API keys" → `service_role`  |
| **JWT Secret**       | For signing tokens               | "JWT Settings" → `JWT Secret`        |

### Step 3: Create Environment File

Create a `.env.local` file in the project root:

```bash
touch .env.local
```

Add the following variables:

```env
# =============================================================================
# SUPABASE CONFIGURATION
# =============================================================================

# Public keys (safe for client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Private keys (server-side only - NEVER expose these!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard
```

### Step 4: Verify Environment Variables

Keys should look like:

| Variable         | Format                                             |
| ---------------- | -------------------------------------------------- |
| URL              | `https://abcdefghij.supabase.co` (~30 chars)       |
| anon key         | `eyJhbGciOiJI...` (~200+ chars, starts with `eyJ`) |
| service_role key | `eyJhbGciOiJI...` (~200+ chars, starts with `eyJ`) |
| JWT Secret       | Random string (~40+ chars)                         |

---

## Database Setup

### Step 1: Run Main Schema

1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the sidebar
3. Click **"New query"**
4. Open `supabase-schema.sql` from the project
5. Copy the entire contents and paste into the SQL Editor
6. Click **"Run"** (or Cmd/Ctrl + Enter)

Expected output:

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

### Step 2: Run Community Tokens Schema (Optional)

To enable community tokens on Polkadot Asset Hub:

1. Open `supabase-community-tokens.sql`
2. Run in SQL Editor

Expected output:

```
✅ Community tokens schema extension created successfully!

Table created:
  - community_tokens
```

### Step 3: Run Known Assets Schema (For Bazaar)

Run this SQL to enable the Polkadot Bazaar feature:

```sql
-- ============================================================================
-- KNOWN ASSETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS known_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id INTEGER UNIQUE NOT NULL,
    ticker TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 10,
    symbol TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_known_assets_id ON known_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_known_assets_category ON known_assets(category);

ALTER TABLE known_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read known assets" ON known_assets
    FOR SELECT USING (true);

-- Insert initial known assets
INSERT INTO known_assets (asset_id, ticker, decimals, symbol, category) VALUES
  (1984, 'USDt', 6, 'https://assets.coingecko.com/coins/images/325/small/Tether.png', 'stablecoin'),
  (1337, 'USDC', 6, 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', 'stablecoin'),
  (30, 'DED', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/DED-LOGO-EYE.png', 'meme'),
  (18, 'DOTA', 4, 'https://raw.githubusercontent.com/nicpick/logos/main/dota.png', 'meme'),
  (23, 'PINK', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/pink.png', 'meme'),
  (31337, 'WUD', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/WUD.png', 'meme'),
  (17, 'WIFD', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/wifd.png', 'meme'),
  (42069, 'STINK', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/stink.png', 'meme'),
  (1107, 'TSN', 18, 'https://raw.githubusercontent.com/nicpick/logos/main/tsn.png', 'utility'),
  (50000111, 'DON', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/don.png', 'utility'),
  (21, 'vDOT', 10, 'https://raw.githubusercontent.com/nicpick/logos/main/vdot.png', 'bridged'),
  (8, 'RMRK', 10, 'https://assets.coingecko.com/coins/images/15320/small/RMRK.png', 'bridged')
ON CONFLICT (asset_id) DO UPDATE SET
  ticker = EXCLUDED.ticker,
  decimals = EXCLUDED.decimals,
  symbol = EXCLUDED.symbol,
  category = EXCLUDED.category,
  updated_at = NOW();
```

### Step 4: Verify Tables

1. Go to **Table Editor** in the sidebar
2. Verify these tables exist:

| Table                | Purpose                   |
| -------------------- | ------------------------- |
| `users`              | User profiles             |
| `auth_nonces`        | Authentication nonces     |
| `friends`            | User friend lists         |
| `transactions`       | Transaction records       |
| `communities`        | Community data            |
| `community_members`  | Community membership      |
| `activities`         | Community activities      |
| `activity_attendees` | Activity participation    |
| `comments`           | Activity comments         |
| `community_tokens`   | Community token configs   |
| `known_assets`       | Polkadot Asset Hub tokens |

---

## Running the Application

### Development Mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Available Scripts

| Script          | Command                 | Description              |
| --------------- | ----------------------- | ------------------------ |
| `dev`           | `npm run dev`           | Start development server |
| `build`         | `npm run build`         | Build for production     |
| `start`         | `npm start`             | Start production server  |
| `lint`          | `npm run lint`          | Run ESLint               |
| `test`          | `npm test`              | Run all tests            |
| `test:watch`    | `npm run test:watch`    | Run tests in watch mode  |
| `test:ui`       | `npm run test:ui`       | Run tests with UI        |
| `test:coverage` | `npm run test:coverage` | Run tests with coverage  |

---

## API Reference

### Authentication Endpoints

#### POST `/api/auth/nonce`

Generate an authentication nonce for wallet signature.

**Request:**

```json
{
  "walletAddress": "1A2B3C4D..."
}
```

**Response:**

```json
{
  "message": "Sign this message to authenticate with Relay...",
  "nonce": "abc123..."
}
```

#### POST `/api/auth/verify`

Verify wallet signature and receive JWT token.

**Request:**

```json
{
  "walletAddress": "1A2B3C4D...",
  "signature": "0x...",
  "nonce": "abc123..."
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Community Endpoints

| Method | Endpoint                       | Description           |
| ------ | ------------------------------ | --------------------- |
| GET    | `/api/community`               | List all communities  |
| POST   | `/api/community/create`        | Create new community  |
| GET    | `/api/community/search?q=term` | Search communities    |
| POST   | `/api/community/join`          | Join a community      |
| POST   | `/api/community/leave`         | Leave a community     |
| GET    | `/api/community/members`       | Get community members |

### Activity Endpoints

| Method | Endpoint                 | Description           |
| ------ | ------------------------ | --------------------- |
| POST   | `/api/activity/join`     | Join an activity      |
| POST   | `/api/activity/leave`    | Leave an activity     |
| POST   | `/api/activity/like`     | Like an activity      |
| POST   | `/api/activity/comment`  | Add a comment         |
| GET    | `/api/activity/comments` | Get activity comments |

### User Endpoints

| Method | Endpoint              | Description                 |
| ------ | --------------------- | --------------------------- |
| GET    | `/api/user/profile`   | Get user profile            |
| GET    | `/api/user/nicknames` | Get nicknames for addresses |

### Friends Endpoints

| Method | Endpoint                       | Description      |
| ------ | ------------------------------ | ---------------- |
| GET    | `/api/friends`                 | List all friends |
| POST   | `/api/friends`                 | Add a friend     |
| PUT    | `/api/friends/[walletAddress]` | Update friend    |
| DELETE | `/api/friends/[walletAddress]` | Remove friend    |

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Unit tests
npm run test:unit

# API tests
npm run test:api

# Component tests
npm run test:components
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Tests with UI

```bash
npm run test:ui
```

---

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
5. Deploy

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-secret
```

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

4. **Test RLS policies** in SQL Editor:

   ```sql
   SELECT auth.jwt();
   ```

5. **View table data** with RLS disabled:
   - Use Table Editor with gear icon

### Reset Database

If you need to start fresh:

1. Go to SQL Editor
2. Uncomment the DROP statements at the top of `supabase-schema.sql`:
   ```sql
   DROP TABLE IF EXISTS auth_nonces CASCADE;
   DROP TABLE IF EXISTS comments CASCADE;
   DROP TABLE IF EXISTS activity_attendees CASCADE;
   DROP TABLE IF EXISTS activities CASCADE;
   DROP TABLE IF EXISTS community_members CASCADE;
   DROP TABLE IF EXISTS communities CASCADE;
   DROP TABLE IF EXISTS transactions CASCADE;
   DROP TABLE IF EXISTS friends CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   ```
3. Run the drops
4. Re-run the full schema

---

## Security Considerations

### Critical Security Rules

1. **Never expose service role key**
   - It bypasses all RLS policies
   - Only use in server-side code

2. **Keep JWT Secret secure**
   - Anyone with it can forge tokens
   - Rotate if compromised

3. **Nonces are one-time use**
   - Prevents replay attacks
   - Automatically cleaned up

4. **Signatures prove ownership**
   - No password needed
   - Private key never leaves device

5. **RLS enforces access control**
   - Database-level security
   - Even if client is compromised

### Environment Variable Security

| Variable                        | Exposure   | Notes          |
| ------------------------------- | ---------- | -------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public     | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public     | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Secret** | Server-only    |
| `SUPABASE_JWT_SECRET`           | **Secret** | Server-only    |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Run lint: `npm run lint`
6. Submit a pull request

---

## License

This project is open source. See the LICENSE file for details.

---

## Support

For questions or issues:

- Open a GitHub issue
- Check the [Supabase documentation](https://supabase.com/docs)
- Check the [Polkadot documentation](https://wiki.polkadot.network)
