/**
 * This file defines the exact data types that are used in the frontend.
 * Type transformation should be done using functions in the utils folder.
 */

export interface Friend {
    nickname: string;
    walletAddress: string;
    network: string; // The name of the crypto network the wallet address is on
    remark: string; // A short description of the friend
}

export interface Transaction {
    id: string;
    sender: string;
    senderAddress: string;
    receiver: string;
    receiverAddress: string;
    network: string; // The name of the crypto network the wallet address is on
    ticker: string; // The ticker symbol of the transacted coin (e.g., "DOT", "USDT")
    amount: number; // The amount in the native coin (not USD)
    amountFiat: number;
    fee: number; // The fee in the native coin
    feesFiat: number;
    timestamp: string;
    status: "completed" | "pending" | "failed"; // Transaction status
    type: "sent" | "received"; // Direction of transaction relative to user
    blockHash?: string; // Optional block hash
    extrinsicIndex?: number; // Optional extrinsic index
}

export interface User {
    avatar: string; // This will be a link to img stored in an online accessible place
    nickname: string;
    wallet: Wallet;
    friends: Friend[];
    socialRecovery: Friend[]; // Selected friends for social recovery
    transactions: Transaction[];
    communities: Community[];
    activities: ActivityId[]; // Activity IDs related to the user
}

export interface Community {
    owner: string; // The public address of the community owner
    name: string;
    description: string; // Description of the community (at least 10 words)
    avatar: string; // A link to img stored in an online accessible place
    communityId: string; // A unique identifier for the community
    rules?: string; // Community rules that members should adhere to
    activityTypes: string[]; // Allowed activity types in this community
    allowInvestment: boolean; // Whether investment is allowed in this community
    activities: ActivityId[]; // Activity IDs within the community
    token?: CommunityToken; // Optional community token on Polkadot Asset Hub
    memberCount?: number; // Number of members in the community
}

/**
 * Community Token on Polkadot Asset Hub
 * Represents a fungible token created via the Assets pallet on Polkadot Asset Hub.
 * See: https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fpolkadot-asset-hub-rpc.polkadot.io#/extrinsics
 */
export interface CommunityToken {
    // Core asset identifiers (from assets.create)
    assetId: number; // Unique numeric ID for the asset on Polkadot Asset Hub (u32)
    admin: string; // Admin account address - can manage the asset
    minBalance: string; // Minimum balance to hold the asset (stored as string for u128 precision)

    // Token metadata (from assets.setMetadata)
    name: string; // Token name (e.g., "Community Token")
    symbol: string; // Token ticker symbol (e.g., "CTKN")
    decimals: number; // Number of decimal places (u8, typically 10-18)

    // Initial supply configuration (from assets.mint)
    initialSupply: string; // Initial supply amount (stored as string for u128 precision)

    // Team roles (from assets.setTeam) - optional, defaults to owner if not set
    issuer?: string; // Account that can mint new tokens
    freezer?: string; // Account that can freeze/thaw accounts

    // Asset status
    isFrozen: boolean; // Whether the asset is frozen (no transfers allowed)
    totalSupply: string; // Current total supply (stored as string for u128 precision)

    // Metadata for UI
    icon?: string; // Link to token icon stored in an online accessible place
    createdAt: string; // ISO timestamp when the token was created
}

export interface Activity {
    communityId: string; // The community ID of the activity
    activityId: string;
    owner: string; // The public address of the activity owner
    title: string;
    description: string;
    isPaid: boolean;
    timestamp: string;
    type: string; // The type of the activity, e.g., meeting, readers party, etc.
    maxAttendees: number; // The maximum allowed number of attendees for the activity
    pictures: string[]; // Links to imgs stored in an online accessible place
    attendees: string[]; // Public addresses of the attendees
    comments: string[]; // Comment IDs
    likes: number;
    status: ActivityStatus; 
    currency?: string; // The payment currency allowed for the activity, e.g., USDT, ETH, etc.
    amount?: number; // The amount to pay for attending the activity in USD
}

export interface Comment {
    commentId: string;
    publisher: string; // The public address of the comment publisher
    content: string;
    timestamp: string;
    likes: number;
}

/**
 * A derived account on a specific chain, managed under the relay wallet.
 * Re-exported from the chain adapter types for convenience.
 */
export { type ChainAccount } from "../chains/types";

export interface Wallet {
    address: string; // Primary address (Polkadot, used for auth)
    network: string; // Primary network name (e.g. "Polkadot Asset Hub")
    chainAccounts: import("../chains/types").ChainAccount[]; // All derived chain accounts
    coins?: Coin[]; // Kept for backward compat (Polkadot coins)
    status: WalletStatus;
    isBackedUp: boolean; // Whether the wallet seed phrase has been backed up
}

export interface Coin {
    ticker: string; // The ticker symbol of the coin, e.g., USDT, ETH, etc.
    amount: number; // The current amount of the coin in the wallet
    change: number; // The change in USD value of the coin in the wallet since the last update
    symbol: string; // The link of the symbol of the coin stored in an online accessible place
    fiatValue: number; // The current USD value of the coin in the wallet
}

/**
 * Known Asset on Polkadot Asset Hub
 * Represents a known fungible asset tracked in the application.
 * These are popular tokens on Asset Hub that users can browse and trade.
 * Reference: https://assethub-polkadot.subscan.io/assets
 */
export interface KnownAsset {
    id: number; // Unique numeric ID for the asset on Polkadot Asset Hub (u32)
    ticker: string; // Token ticker symbol (e.g., "USDt", "USDC", "DED")
    decimals: number; // Number of decimal places (u8, typically 6-18)
    symbol: string; // URL to the token icon/logo
    category?: string; // Optional category (e.g., "stablecoin", "meme", "utility", "bridged")
}

// ===== Ecosystem Explorer Types =====

/** Category for ecosystem projects displayed in the Explore section. */
export type ProjectCategory = "dex" | "lending" | "nft" | "bridge" | "staking" | "infra" | "gaming";

/**
 * A curated DApp/protocol entry stored in Supabase.
 * Displayed in the multi-chain Explore section of the wallet page.
 */
export interface EcosystemProject {
    id: string;
    name: string;
    slug: string;
    description: string;
    chainId: import("../chains/types").ChainId;
    category: string;
    logoUrl: string;
    websiteUrl: string;
    twitterUrl?: string;
    defillamaSlug?: string;
    featured: boolean;
}

/**
 * An EcosystemProject enriched with live stats from DeFiLlama.
 */
export interface ProjectWithStats extends EcosystemProject {
    tvl?: number;
    tvlChange24h?: number;
}

export type ActivityId = Activity["activityId"];
export type CommentId = Comment["commentId"];
export type ActivityStatus = "open" | "attending" | "full" | "finished" | "cancelled";
export type WalletStatus = "active" | "inactive" | "marked";

// ===== Agent Championship Types =====

export type ChallengeStatus = "enrolling" | "competing" | "judging" | "completed";

/**
 * A championship challenge where agents compete.
 * Three phases: enroll -> compete -> judge, each with a deadline.
 */
export interface Challenge {
    challengeId: string;
    creator: string;             // Wallet address of the challenge creator
    title: string;
    description: string;
    rules?: string;
    enrollEnd: string;           // ISO timestamp
    competeEnd: string;          // ISO timestamp
    judgeEnd: string;            // ISO timestamp
    status: ChallengeStatus;
    escrowAddress: string;
    entryFeeDot: string;         // DOT amount to enroll (string for bigint precision)
    totalEntryPoolDot: string;   // Sum of all entry fees
    totalBetPoolDot: string;     // Sum of all bets
    agentCount?: number;
    winnerAgentId?: string;      // Set after judging completes
}

/**
 * An agent enrolled in a challenge. Bound to the owner's wallet.
 * Must be open source (repo_url) and have a deployed endpoint.
 */
export interface ChallengeAgent {
    id: string;
    challengeId: string;
    owner: string;               // Wallet address of the agent owner
    agentName: string;
    repoUrl: string;             // GitHub URL (open source)
    commitHash: string;          // Pinned version for reproducibility
    endpointUrl: string;         // Deployed API endpoint
    description: string;
    entryTxHash: string;         // Proof of entry fee payment
    entryVerified: boolean;
    totalVotes: number;
    enrolledAt: string;
}

/**
 * A DOT bet placed on an agent during the compete phase.
 * Verified on-chain via tx_hash.
 */
export interface ChallengeBet {
    id: string;
    challengeId: string;
    bettor: string;              // Wallet address of the bettor
    agentId: string;
    amountDot: string;           // String for bigint precision
    txHash: string;
    verified: boolean;
    placedAt: string;
}

/**
 * A vote cast during the judge phase. One vote per wallet per challenge.
 */
export interface ChallengeVote {
    challengeId: string;
    voter: string;               // Wallet address of the voter
    agentId: string;
}

/**
 * A payout record for audit purposes. Designed for future smart contract migration.
 */
export interface ChallengePayout {
    challengeId: string;
    recipient: string;           // Wallet address of the payout recipient
    amountDot: string;
    payoutType: "entry_prize" | "bet_winnings" | "platform_entry_fee" | "platform_bet_fee";
    txHash?: string;
    status: "pending" | "completed" | "failed";
}

// ===== Staking Types =====

/**
 * Lightweight pool summary for list display (lazy loading)
 * Contains only the essential data needed for the pool card
 */
export interface PoolSummary {
    id: number;
    name: string;
    state: "Open" | "Blocked" | "Destroying";
    memberCount: number;
}

/**
 * Paginated response for pool summaries
 */
export interface PaginatedPoolSummaries {
    pools: PoolSummary[];
    currentPage: number;
    totalPages: number;
    totalPools: number;
    pageSize: number;
}

/**
 * Full nomination pool details (fetched on demand)
 * Extends PoolSummary with additional expensive-to-fetch data
 */
export interface PoolDetails extends PoolSummary {
    bond: string; // Total bonded amount as string (for bigint precision)
    commission: number; // Commission rate in 0-1 range
    addresses: {
        stash: string;
        reward: string;
        bouncer: string;
    };
}

/**
 * Nomination Pool information from the Staking SDK
 * Represents a pool that users can join to stake their DOT
 * @deprecated Use PoolSummary for list and PoolDetails for detail view
 */
export interface NominationPoolInfo {
    id: number;
    name: string;
    state: "Open" | "Blocked" | "Destroying";
    memberCount: number;
    bond: string; // Total bonded amount as string (for bigint precision)
    commission: number; // Commission rate in 0-1 range
    addresses: {
        stash: string;
        reward: string;
        bouncer: string;
    };
}

/**
 * User's staking status in a nomination pool
 */
export interface UserStakingStatus {
    pool: number | null; // Pool ID if staked, null otherwise
    currentBond: string; // Current bonded amount as string
    points: string; // Pool points as string
    pendingRewards: string; // Claimable rewards as string
    unlocks: StakingUnlock[];
}

/**
 * Unlock schedule entry for unbonding funds
 */
export interface StakingUnlock {
    value: string; // Amount being unlocked as string
    era: number; // Era when funds will be unlocked
}

/**
 * Account balance information for staking
 */
export interface StakingBalance {
    total: string;
    locked: string;
    spendable: string;
    existentialDeposit: string;
}

/**
 * Combined account status for staking operations
 */
export interface StakingAccountStatus {
    balance: StakingBalance;
    nominationPool: UserStakingStatus;
}

/**
 * Result of a staking transaction
 */
export interface StakingTransactionResult {
    success: boolean;
    txHash?: string;
    blockHash?: string;
    error?: string;
}