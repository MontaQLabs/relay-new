/**
 * This file defines the exact data types that are used in the frontend.
 * Type transformation should be done using functions in the utils folder.
 */

export interface Friend {
    id: string;
    nickname: string;
    walletAddress: string;
    avatar?: string;
}

export interface Transaction {
    id: string;
    sender: string;
    receiver: string;
    network: string;
    amountCrypto: number;
    fees: number;
    timestamp: number;
}

export interface User {
    avatar: string; // This will be a link to img stored in an online accessible place
    nickname: string;
    walletAddress: string; // Public address of the user's wallet
    friends: Friend[];
    socialRecovery: Friend[]; // Selected friends for social recovery
    transactions: Transaction[];
}
