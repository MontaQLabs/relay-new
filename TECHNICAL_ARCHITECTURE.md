# Relay - Technical Architecture Document

> Comprehensive technical documentation of the Relay multi-chain Web3 application

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Multi-Chain Architecture](#multi-chain-architecture)
4. [Championship Escrow System](#championship-escrow-system)
5. [Authentication & Security](#authentication--security)
6. [Data Flow & State Management](#data-flow--state-management)
7. [Database Architecture](#database-architecture)
8. [API Architecture](#api-architecture)
9. [Smart Contract Integration](#smart-contract-integration)
10. [Technology Stack](#technology-stack)
11. [Deployment Architecture](#deployment-architecture)

---

## System Overview

Relay is a **multi-chain Web3 application** that provides:

1. **Unified Multi-Chain Wallet**: Single mnemonic generates addresses across Polkadot, Solana, NEAR, Base, and Monad
2. **Community Management**: Create and manage communities with activities, comments, and social features
3. **Championship Escrow System**: Decentralized agent competition platform with on-chain escrow contracts
4. **Passwordless Authentication**: Cryptographic wallet-based authentication using sr25519 signatures
5. **Cross-Chain Operations**: Unified interface for transfers, balances, and transaction history across all supported chains

### Core Principles

- **Chain Abstraction**: Uniform API for all blockchain operations via `ChainAdapter` interface
- **Security First**: Row-Level Security (RLS), JWT-based auth, cryptographic signatures
- **Smart Contract Ready**: Treasury service abstraction allows seamless migration from Supabase to on-chain contracts
- **Multi-Chain Native**: Single mnemonic derives addresses on all supported chains

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                             │
│  Next.js 16 App Router | React 19 | TailwindCSS 4 | TypeScript          │
│  - Dashboard Pages                                                       │
│  - Championship UI                                                       │
│  - Wallet Interface                                                       │
│  - Community Management                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                              │
│  Next.js API Routes (Edge-Compatible)                                    │
│  - /api/auth/*          (Authentication)                                 │
│  - /api/championship/*  (Championship operations)                         │
│  - /api/community/*     (Community CRUD)                                 │
│  - /api/activity/*      (Activity management)                            │
│  - /api/user/*          (User profiles)                                  │
│  - /api/friends/*       (Social features)                                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                  │
│  - TreasuryService      (Financial operations abstraction)               │
│  - ChainRegistry        (Multi-chain adapter management)                 │
│  - SupabaseClient      (Database operations)                            │
│  - AuthService         (JWT & signature verification)                    │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
│  ┌──────────────────────┐          ┌──────────────────────────────┐     │
│  │   Supabase (PostgreSQL)        │   Multi-Chain Blockchains     │     │
│  │   - Users, Communities         │   - Polkadot Asset Hub        │     │
│  │   - Activities, Comments        │   - Solana Testnet            │     │
│  │   - Championships               │   - NEAR Testnet              │     │
│  │   - Transactions                │   - Base (EVM)                │     │
│  │   - RLS Policies                │   - Monad (EVM)               │     │
│  └──────────────────────┘          └──────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Chain Architecture

### Chain Registry Pattern

The system uses a **Chain Registry** singleton that manages all blockchain adapters through a uniform interface:

```typescript
interface ChainAdapter {
  chainId: ChainId;
  chainName: string;
  chainType: "substrate" | "evm" | "solana" | "near";
  
  // Account operations
  deriveAddress(mnemonic: string): Promise<string>;
  isValidAddress(address: string): boolean;
  
  // Balance & transaction operations
  fetchBalances(address: string): Promise<ChainCoin[]>;
  estimateFee(params: TransferParams): Promise<ChainFeeEstimate>;
  sendTransfer(params: SignedTransferParams): Promise<ChainTransferResult>;
  fetchTransactions(address: string, page?: number): Promise<ChainTransaction[]>;
}
```

### Supported Chains

| Chain | Type | Native Token | RPC Endpoint | Adapter |
|-------|------|--------------|--------------|---------|
| Polkadot Asset Hub | Substrate | DOT | `wss://polkadot-asset-hub-rpc.polkadot.io` | `PolkadotChainAdapter` |
| Solana | Solana | SOL | `https://api.testnet.solana.com` | `SolanaChainAdapter` |
| NEAR | NEAR | NEAR | `https://rpc.testnet.near.org` | `NearChainAdapter` |
| Base | EVM | ETH | `https://sepolia.base.org` | `EVMChainAdapter` |
| Monad | EVM | MON | Custom RPC | `EVMChainAdapter` |

### Address Derivation

**Single Mnemonic → Multiple Addresses**

From a single BIP-39 mnemonic, the system derives addresses using chain-specific derivation paths:

```typescript
// Polkadot: sr25519 with SS58 encoding
const keyring = new Keyring({ type: "sr25519", ss58Format: 0 });
const pair = keyring.addFromMnemonic(mnemonic);

// Solana: Ed25519 from BIP-44 path m/44'/501'/0'/0'
const seed = mnemonicToSeedSync(mnemonic);
const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
const keypair = Keypair.fromSeed(derivedSeed.key);

// NEAR: Ed25519 from BIP-44 path m/44'/397'/0'
const seed = mnemonicToSeedSync(mnemonic);
const derivedSeed = derivePath("m/44'/397'/0'", seed.toString('hex'));
const keyPair = KeyPair.fromString(derivedSeed.key.toString('hex'));

// EVM (Base/Monad): ECDSA from BIP-44 path m/44'/60'/0'/0/0
const account = mnemonicToAccount(mnemonic);
```

### Chain Registry Initialization

```typescript
// Lazy initialization on first access
export async function initChainRegistry(): Promise<ChainRegistry> {
  const registry = getChainRegistry();
  
  if (registry.getAll().length > 0) return registry;
  
  // Dynamic imports for code splitting
  const [
    { PolkadotChainAdapter },
    { createBaseAdapter, createMonadAdapter },
    { SolanaChainAdapter },
    { NearChainAdapter },
  ] = await Promise.all([
    import("./polkadot/adapter"),
    import("./evm/chains"),
    import("./solana/adapter"),
    import("./near/adapter"),
  ]);
  
  registry.register(new PolkadotChainAdapter());
  registry.register(createBaseAdapter());
  registry.register(createMonadAdapter());
  registry.register(new SolanaChainAdapter());
  registry.register(new NearChainAdapter());
  
  return registry;
}
```

---

## Championship Escrow System

### Overview

The Championship Escrow system enables decentralized agent competitions with on-chain escrow contracts deployed on **Solana** and **NEAR** blockchains. The system manages:

1. **Challenge Lifecycle**: Creation → Enrollment → Competition → Judging → Finalization
2. **Entry Fees**: Agents pay entry fees to participate
3. **Betting Pool**: Users bet on agents during competition phase
4. **Voting**: Users vote for winners during judging phase
5. **Payouts**: Automatic distribution of prizes, bet winnings, and platform fees

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CHAMPIONSHIP ESCROW ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐     │
│  │   Frontend   │────────▶│  API Routes  │────────▶│   Supabase   │     │
│  │  (Next.js)   │         │  (Next.js)    │         │  (PostgreSQL)│     │
│  └──────────────┘         └──────────────┘         └──────────────┘     │
│         │                        │                        │              │
│         │                        │                        │              │
│         ▼                        ▼                        ▼              │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐     │
│  │  Treasury    │────────▶│  On-Chain    │────────▶│  Smart       │     │
│  │  Service     │         │  Verification│         │  Contracts   │     │
│  │  (Abstraction)│         │  (RPC Calls) │         │  (Solana/NEAR)│    │
│  └──────────────┘         └──────────────┘         └──────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Challenge Phases

1. **Enrollment Phase** (`enrolling`)
   - Challenge creator sets entry fee, deadlines, rules
   - Agents enroll by submitting agent info + entry fee payment
   - Entry fees collected in escrow address
   - Minimum 3 agents required

2. **Competition Phase** (`competing`)
   - Agents compete based on challenge rules
   - Users can place bets on agents
   - Bet amounts collected in escrow
   - Creator cannot bet on their own challenge

3. **Judging Phase** (`judging`)
   - Users vote for winning agents
   - One vote per wallet per challenge
   - Minimum balance requirement (1 DOT) to vote
   - Votes counted to determine winner

4. **Completed Phase** (`completed`)
   - Challenge finalized
   - Winner determined (most votes)
   - Payouts calculated and executed:
     - 95% of entry pool → Winner
     - 4% of entry pool → Creator
     - 1% of entry pool → Platform
     - 98% of bet pool → Winning bettors (proportional)
     - 2% of bet pool → Platform

### Treasury Service Abstraction

The `TreasuryService` interface provides a clean abstraction for financial operations:

```typescript
interface ITreasuryService {
  // Deposits
  recordEntryPayment(params: {
    challengeId: string;
    walletAddress: string;
    amountDot: string;
    txHash: string;
  }): Promise<{ verified: boolean; error?: string }>;
  
  recordBet(params: {
    challengeId: string;
    walletAddress: string;
    agentId: string;
    amountDot: string;
    txHash: string;
  }): Promise<{ verified: boolean; error?: string }>;
  
  // Verification
  verifyOnChainTransfer(params: {
    txHash: string;
    expectedSender: string;
    expectedDestination: string;
    expectedAmount: string;
  }): Promise<boolean>;
  
  // Payouts
  calculatePayouts(challengeId: string): Promise<PayoutPlan>;
  executePayouts(challengeId: string, plan: PayoutPlan): Promise<PayoutResult[]>;
  
  // Queries
  getEntryPool(challengeId: string): Promise<string>;
  getBetPool(challengeId: string): Promise<string>;
  getUserBets(challengeId: string, wallet: string): Promise<ChallengeBet[]>;
}
```

**Current Implementation**: `SupabaseTreasuryService`
- Stores financial data in Supabase
- Verifies on-chain transfers via RPC calls
- Calculates and records payouts in database

**Future Migration**: Smart contract implementation
- Replace `SupabaseTreasuryService` with `SmartContractTreasuryService`
- All financial operations execute on-chain
- No changes required to API routes or frontend

### Smart Contracts

#### Solana Contract

**Program ID**: `AvNFV1Bg6ZfngTuGdd5uDDxV22nsmumYd3JUpkQu9MPT`  
**Network**: Solana Testnet  
**Language**: Rust (Anchor framework)

**Key Instructions**:
- `create`: Initialize a new challenge escrow
- `enroll`: Enroll an agent and deposit entry fee
- `bet`: Place a bet on an agent
- `vote`: Cast a vote for an agent
- `cancel`: Cancel a challenge (if conditions met)
- `finalize`: Finalize challenge and determine winner
- `claim`: Claim payouts or refunds

**Account Structure**:
```rust
pub struct Challenge {
    pub creator: Pubkey,
    pub platform: Pubkey,
    pub challenge_id: [u8; 32],
    pub entry_fee: u64,
    pub enroll_end: i64,
    pub compete_end: i64,
    pub judge_end: i64,
    pub total_entry_pool: u64,
    pub total_bet_pool: u64,
    pub agent_count: u8,
    pub finalized: bool,
    pub cancelled: bool,
    pub winner_index: u8,
    pub agent_ids: Vec<[u8; 32]>,
    pub agent_owners: Vec<Pubkey>,
    pub vote_counts: Vec<u64>,
    pub agent_bet_pools: Vec<u64>,
}
```

#### NEAR Contract

**Account ID**: `championship.montaq.testnet`  
**Network**: NEAR Testnet  
**Language**: Rust (NEAR SDK)

**Key Methods**:
- `new`: Initialize contract
- `create`: Create a new challenge
- `enroll`: Enroll an agent
- `bet`: Place a bet
- `vote`: Cast a vote
- `cancel`: Cancel challenge
- `finalize`: Finalize and determine winner
- `claim`: Claim payouts
- `get_challenge`: Query challenge state
- `get_agent_count`: Query agent count

**Storage Structure**:
```rust
pub struct ChampionshipEscrow {
    pub platform: AccountId,
    pub challenges: UnorderedMap<String, Challenge>,
    pub agent_ids: LookupMap<String, Vector<String>>,
    pub agents: LookupMap<String, LookupMap<String, AgentInfo>>,
    pub has_enrolled: LookupMap<String, LookupMap<AccountId, bool>>,
    pub has_voted: LookupMap<String, LookupMap<AccountId, bool>>,
    pub vote_count: LookupMap<String, LookupMap<String, u64>>,
    pub bets: LookupMap<String, LookupMap<String, u128>>,
    pub agent_bet_pool: LookupMap<String, LookupMap<String, u128>>,
    pub total_user_bets: LookupMap<String, LookupMap<AccountId, u128>>,
    pub has_claimed: LookupMap<String, LookupMap<AccountId, bool>>,
}
```

### On-Chain Verification Flow

```
1. User submits transaction on-chain (entry fee, bet, etc.)
   └─▶ Transaction hash returned

2. User calls API endpoint with txHash
   └─▶ API calls TreasuryService.recordEntryPayment() or recordBet()

3. TreasuryService.verifyOnChainTransfer()
   ├─▶ Fetch transaction from blockchain RPC
   ├─▶ Verify sender address matches user
   ├─▶ Verify destination matches escrow address
   ├─▶ Verify amount matches expected
   └─▶ Return verification result

4. If verified:
   ├─▶ Update Supabase database
   ├─▶ Mark entry/bet as verified
   └─▶ Update pool totals
```

---

## Authentication & Security

### Wallet-Based Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WALLET AUTHENTICATION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User generates/imports wallet (BIP-39 mnemonic)                    │
│     └─▶ Derives Polkadot address (used as primary identity)            │
│                                                                          │
│  2. User requests authentication                                        │
│     └─▶ POST /api/auth/nonce { walletAddress }                         │
│     └─▶ Server generates unique nonce, stores in auth_nonces table     │
│     └─▶ Returns: { message, nonce }                                     │
│                                                                          │
│  3. User signs message with private key                                │
│     └─▶ Uses @polkadot/keyring with sr25519 curve                      │
│     └─▶ keypair.sign(message) → signature                              │
│                                                                          │
│  4. User submits signature                                              │
│     └─▶ POST /api/auth/verify { walletAddress, signature, nonce }      │
│     └─▶ Server verifies signature using @polkadot/util-crypto          │
│     └─▶ Server creates/updates user in users table                      │
│     └─▶ Server generates JWT with wallet_address claim (24h expiry)    │
│     └─▶ Returns: { token }                                              │
│                                                                          │
│  5. Client stores JWT                                                   │
│     └─▶ All subsequent API requests include:                            │
│         Authorization: Bearer <token>                                   │
│                                                                          │
│  6. Server validates JWT on each request                                 │
│     └─▶ Extracts wallet_address from JWT payload                       │
│     └─▶ RLS policies use auth.jwt() ->> 'wallet_address'               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security Features

1. **Cryptographic Signatures**
   - No passwords stored
   - Private keys never leave user's device
   - sr25519 signatures prove wallet ownership

2. **One-Time Nonces**
   - Prevents replay attacks
   - 5-minute expiry
   - Deleted after use

3. **JWT Tokens**
   - Stateless session management
   - 24-hour expiry
   - Signed with SUPABASE_JWT_SECRET

4. **Row-Level Security (RLS)**
   - Database-level access control
   - Policies check JWT wallet_address
   - Even if client is compromised, database enforces access

5. **Service Role Key Protection**
   - Never exposed to client
   - Only used server-side
   - Bypasses RLS (use with caution)

### RLS Policy Example

```sql
-- Users can only read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (wallet_address = auth.jwt() ->> 'wallet_address')
    WITH CHECK (wallet_address = auth.jwt() ->> 'wallet_address');
```

---

## Data Flow & State Management

### Frontend State Management

- **Local Storage**: Wallet mnemonic (encrypted), JWT token, user preferences
- **React State**: Component-level state for UI interactions
- **Supabase Realtime**: Live updates for activities, comments (subscriptions)
- **No Global State Library**: Uses React hooks and context where needed

### Data Flow Patterns

#### 1. Wallet Operations

```
User Action (Send Transfer)
  └─▶ Frontend: Get mnemonic from localStorage
  └─▶ Frontend: Get chain adapter from registry
  └─▶ Frontend: Call adapter.sendTransfer()
  └─▶ Adapter: Sign transaction with mnemonic
  └─▶ Adapter: Submit to blockchain RPC
  └─▶ Blockchain: Process transaction
  └─▶ Adapter: Return txHash
  └─▶ Frontend: Update UI, fetch new balance
```

#### 2. Championship Operations

```
User Action (Enroll Agent)
  └─▶ Frontend: User pays entry fee on-chain
  └─▶ Frontend: Get txHash from blockchain
  └─▶ Frontend: POST /api/championship/enroll { challengeId, agentName, ..., entryTxHash }
  └─▶ API: Verify JWT token
  └─▶ API: Validate request body
  └─▶ API: Check challenge exists and is enrolling
  └─▶ API: Insert agent into challenge_agents table
  └─▶ API: Call TreasuryService.recordEntryPayment()
  └─▶ TreasuryService: Verify on-chain transfer via RPC
  └─▶ TreasuryService: Update entry pool in database
  └─▶ API: Return { success: true, agentId }
  └─▶ Frontend: Update UI, show success message
```

#### 3. Community Operations

```
User Action (Create Activity)
  └─▶ Frontend: POST /api/activity/create { communityId, title, ... }
  └─▶ API: Verify JWT token
  └─▶ API: Check user is member of community
  └─▶ API: Insert into activities table
  └─▶ Supabase: RLS policy validates access
  └─▶ Supabase: Realtime subscription notifies other members
  └─▶ API: Return { success: true, activityId }
  └─▶ Frontend: Update UI, show new activity
```

---

## Database Architecture

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE DATABASE SCHEMA                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐          │
│  │    users     │      │ communities  │      │  activities  │          │
│  │              │      │              │      │              │          │
│  │ - wallet_*   │◄─────┤ - id         │◄─────┤ - id         │          │
│  │ - nickname   │      │ - creator_*  │      │ - community_*│          │
│  │ - avatar_url │      │ - name       │      │ - title      │          │
│  └──────────────┘      │ - description│      │ - description│          │
│                        └──────────────┘      │ - scheduled_* │          │
│                                │            └──────────────┘          │
│                                │                    │                  │
│                                ▼                    ▼                  │
│                        ┌──────────────┐      ┌──────────────┐          │
│                        │ community_   │      │   comments   │          │
│                        │   members    │      │              │          │
│                        │              │      │ - activity_* │          │
│                        │ - community_*│      │ - author_*   │          │
│                        │ - member_*   │      │ - content    │          │
│                        └──────────────┘      └──────────────┘          │
│                                                                          │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐          │
│  │ challenges  │      │ challenge_  │      │ challenge_   │          │
│  │              │      │   agents     │      │    bets      │          │
│  │ - challenge_*│◄─────┤ - challenge_*│     │ - challenge_*│          │
│  │ - creator_*  │      │ - owner_*    │      │ - bettor_*   │          │
│  │ - entry_fee_*│      │ - agent_name │      │ - agent_id   │          │
│  │ - status     │      │ - repo_url   │      │ - amount_*   │          │
│  └──────────────┘      │ - entry_tx_*│      │ - tx_hash    │          │
│         │              └──────────────┘      └──────────────┘          │
│         │                                                                 │
│         ▼              ┌──────────────┐      ┌──────────────┐          │
│  ┌──────────────┐      │ challenge_   │      │ challenge_   │          │
│  │ challenge_   │      │   votes      │      │  payouts     │          │
│  │  payouts     │      │              │      │              │          │
│  │              │      │ - challenge_* │      │ - challenge_*│          │
│  │ - challenge_*│      │ - voter_*    │      │ - recipient_*│          │
│  │ - recipient_*│      │ - agent_id   │      │ - amount_*   │          │
│  │ - amount_*   │      └──────────────┘      │ - payout_type│          │
│  │ - payout_type│                            │ - status     │          │
│  └──────────────┘                            └──────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Tables

#### Core Tables

- **users**: User profiles keyed by wallet_address
- **auth_nonces**: One-time authentication nonces (5-min expiry)
- **communities**: Community definitions
- **community_members**: Membership relationships
- **activities**: Community activities/events
- **comments**: Activity comments
- **friends**: User friend lists
- **transactions**: Transaction history cache

#### Championship Tables

- **challenges**: Challenge definitions and state
- **challenge_agents**: Enrolled agents per challenge
- **challenge_bets**: Bet records
- **challenge_votes**: Vote records
- **challenge_payouts**: Payout audit trail

#### Asset Tables

- **known_assets**: Polkadot Asset Hub token metadata
- **community_tokens**: Community-issued token configs

### Row-Level Security (RLS)

All tables have RLS enabled with policies that:

1. **Public Read**: Most tables allow public SELECT (for listings, public data)
2. **Authenticated Write**: INSERT/UPDATE require valid JWT with matching wallet_address
3. **Owner-Only Updates**: Users can only modify their own records
4. **Creator Privileges**: Challenge creators can update challenge status

---

## API Architecture

### API Route Structure

```
app/api/
├── auth/
│   ├── nonce/route.ts      # Generate auth nonce
│   └── verify/route.ts     # Verify signature, issue JWT
│
├── championship/
│   ├── create/route.ts     # Create challenge
│   ├── enroll/route.ts     # Enroll agent
│   ├── bet/route.ts        # Place bet
│   ├── vote/route.ts       # Cast vote
│   ├── [challengeId]/
│   │   ├── route.ts        # Get challenge details
│   │   ├── agents/route.ts # List agents
│   │   ├── bets/route.ts   # List bets
│   │   ├── results/route.ts # Get results
│   │   └── finalize/route.ts # Finalize challenge
│   └── route.ts            # List challenges
│
├── community/
│   ├── create/route.ts     # Create community
│   ├── join/route.ts       # Join community
│   ├── leave/route.ts      # Leave community
│   ├── members/route.ts   # List members
│   └── route.ts           # List/search communities
│
├── activity/
│   ├── create/route.ts  # Create activity
│   ├── join/route.ts     # Join activity
│   ├── leave/route.ts    # Leave activity
│   ├── like/route.ts     # Like activity
│   ├── comment/route.ts  # Add comment
│   └── comments/route.ts # List comments
│
├── user/
│   ├── profile/route.ts   # Get user profile
│   └── nicknames/route.ts # Get nicknames for addresses
│
└── friends/
    └── route.ts           # CRUD operations for friends
```

### Authentication Middleware

All protected routes use JWT verification:

```typescript
async function verifyToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  
  const token = authHeader.substring(7);
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.wallet_address as string) || null;
  } catch {
    return null;
  }
}
```

### Error Handling

All API routes follow consistent error response format:

```typescript
// Success
return NextResponse.json({ success: true, data: ... });

// Error
return NextResponse.json(
  { error: "Error message" },
  { status: 400 | 401 | 404 | 500 }
);
```

---

## Smart Contract Integration

### Contract Deployment Status

#### Solana Contract
- **Network**: Solana Testnet
- **Program ID**: `AvNFV1Bg6ZfngTuGdd5uDDxV22nsmumYd3JUpkQu9MPT`
- **Program Data**: `F7SY2yJrNrJwUj7BbNiArECK8EQpgXtrABUR41D33GEr`
- **Upgrade Authority**: `DVGZchVvjRxz3UYnqAuf6DdGyBzYZhF1SEaEjz9Kr6wF`
- **IDL Account**: `7K3guaEqHTVq9ZvfN7E86jtb9p2gRwAJAj4Caq1pig2U`
- **Deployed Slot**: 388942893
- **Program Size**: 357,592 bytes (~349 KB)

#### NEAR Contract
- **Network**: NEAR Testnet
- **Account ID**: `championship.montaq.testnet`
- **Balance**: 4.990806 Ⓝ
- **Storage Used**: 124.52 KB
- **Contract Locked**: No

### Contract Interaction Flow

```
1. Frontend initiates operation (enroll, bet, vote)
   └─▶ User signs transaction with wallet
   └─▶ Transaction submitted to blockchain
   └─▶ Transaction hash returned

2. Frontend calls API with txHash
   └─▶ API verifies JWT authentication
   └─▶ API calls TreasuryService

3. TreasuryService verifies on-chain transaction
   └─▶ Fetches transaction from RPC
   └─▶ Validates sender, recipient, amount
   └─▶ Updates database state

4. Future: Direct smart contract calls
   └─▶ TreasuryService calls contract methods directly
   └─▶ No database state needed (fully on-chain)
```

### Contract Methods

#### Solana Program Instructions

1. `create` - Initialize challenge escrow
2. `enroll` - Enroll agent and deposit entry fee
3. `bet` - Place bet on agent
4. `vote` - Cast vote for agent
5. `cancel` - Cancel challenge
6. `finalize` - Finalize challenge and determine winner
7. `claim` - Claim payouts or refunds

#### NEAR Contract Methods

1. `new` - Initialize contract
2. `create` - Create challenge
3. `enroll` - Enroll agent
4. `bet` - Place bet
5. `vote` - Cast vote
6. `cancel` - Cancel challenge
7. `finalize` - Finalize challenge
8. `claim` - Claim payouts
9. `get_challenge` - Query challenge state
10. `get_agent_count` - Query agent count
11. `contract_source_metadata` - Contract metadata

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.7 | React framework, App Router, API routes |
| React | 19.2.0 | UI library |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 4.x | Styling |
| Radix UI | Latest | Accessible component primitives |
| Lucide React | Latest | Icons |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | 16.0.7 | Serverless API endpoints |
| Supabase | 2.47.10 | PostgreSQL database, RLS, auth |
| jose | 5.9.6 | JWT verification |

### Blockchain Integration

| Technology | Version | Purpose |
|------------|---------|---------|
| polkadot-api | 1.22.0 | Polkadot/Substrate interaction |
| @polkadot/keyring | 13.5.9 | Key management, sr25519 |
| @polkadot/util-crypto | 13.5.9 | Cryptographic utilities |
| @solana/web3.js | 1.98.4 | Solana RPC client |
| @solana/spl-token | 0.4.14 | SPL token operations |
| near-api-js | 7.1.1 | NEAR RPC client |
| viem | 2.46.1 | EVM chain interaction |

### Cryptography

| Technology | Version | Purpose |
|------------|---------|---------|
| @scure/bip39 | 2.0.1 | BIP-39 mnemonic generation/validation |
| ed25519-hd-key | 1.3.0 | HD key derivation for Solana/NEAR |

### Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | 2.1.8 | Test runner |
| @testing-library/react | 16.1.0 | React component testing |
| @testing-library/jest-dom | 6.6.3 | DOM matchers |

### Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| ESLint | 9.x | Code linting |
| TypeScript | 5.x | Type checking |
| papi generate | Postinstall | Polkadot API descriptor generation |

---

## Deployment Architecture

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only
SUPABASE_JWT_SECRET=xxx           # Server-only

# Platform
PLATFORM_WALLET_ADDRESS=xxx       # For championship payouts

# Contracts (optional, for direct contract interaction)
SOLANA_PROGRAM_ID=xxx
NEAR_ACCOUNT_ID=xxx
```

### Deployment Targets

1. **Vercel** (Recommended)
   - Next.js optimized
   - Edge functions support
   - Automatic deployments from Git

2. **Supabase**
   - Database hosted on Supabase
   - RLS policies enforced server-side
   - Realtime subscriptions

3. **Blockchain Networks**
   - Polkadot Asset Hub (Mainnet/Testnet)
   - Solana (Mainnet/Testnet)
   - NEAR (Mainnet/Testnet)
   - Base (Sepolia Testnet)
   - Monad (Testnet)

### Build Process

```bash
# Install dependencies
npm install
# Runs: papi generate (postinstall)

# Build for production
npm run build
# Runs: papi generate && next build

# Start production server
npm start
```

### Database Migrations

1. Run `supabase-schema.sql` for core tables
2. Run `supabase-community-tokens.sql` for token support
3. Run `supabase-championship.sql` for championship tables
4. Run known assets SQL for Polkadot Bazaar

---

## Future Enhancements

### Planned Features

1. **Full Smart Contract Migration**
   - Replace SupabaseTreasuryService with SmartContractTreasuryService
   - All financial operations on-chain
   - No database dependency for escrow

2. **Cross-Chain Bridge Integration**
   - Bridge assets between chains
   - Unified balance view across chains

3. **Advanced Staking**
   - Staking interface for Polkadot validators
   - Staking rewards tracking

4. **NFT Support**
   - NFT display and management
   - Community NFT collections

5. **Mobile App**
   - React Native implementation
   - WalletConnect integration

---

## Conclusion

Relay is a sophisticated multi-chain Web3 application that provides:

- **Unified multi-chain wallet** from a single mnemonic
- **Decentralized championship escrow** with on-chain contracts
- **Passwordless authentication** via cryptographic signatures
- **Community management** with social features
- **Smart contract abstraction** for future migration

The architecture is designed for:
- **Scalability**: Chain adapter pattern allows easy addition of new chains
- **Security**: RLS, JWT, cryptographic signatures
- **Flexibility**: Treasury service abstraction enables smart contract migration
- **Developer Experience**: Type-safe, well-structured, testable codebase

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Maintained By**: MontaQ Labs
