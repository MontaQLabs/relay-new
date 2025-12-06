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

### Verify Tables

1. Go to **Table Editor** in the sidebar
2. You should see all 9 tables listed (10 with community_tokens)
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
| `createCommunity(ownerWallet, data)` | Create new community |
| `updateCommunity(communityId, updates)` | Update community (owner only) |
| `deleteCommunity(communityId)` | Delete community (owner only) |
| `joinCommunity(communityId, userWallet)` | Join a community |
| `leaveCommunity(communityId, userWallet)` | Leave a community |

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
