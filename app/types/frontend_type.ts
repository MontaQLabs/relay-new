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
    amountFiat: number;
    feesFiat: number;
    timestamp: string;
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
    avatar: string; // A link to img stored in an online accessible place
    communityId: string; // A unique identifier for the community
    activities: ActivityId[]; // Activity IDs within the community
    token?: CommunityToken; // Optional community token on Polkadot Asset Hub
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

export interface Wallet {
    address: string; // Public address of the wallet
    network: string; // The name of the crypto network the wallet is on
    coins?: Coin[];
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

export type ActivityId = Activity["activityId"];
export type CommentId = Comment["commentId"];
export type ActivityStatus = "open" | "full" | "finished" | "cancelled";
export type WalletStatus = "active" | "inactive" | "marked";