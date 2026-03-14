/**
 * Chain-agnostic escrow adapter interface.
 *
 * Each supported chain implements IEscrowAdapter so the API layer
 * can interact with any chain's escrow contract through a uniform API.
 */

import type { ChainId } from "../../chains/types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface TxResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface CreateChallengeParams {
  challengeId: Uint8Array; // 32-byte identifier
  entryFee: bigint; // in chain-native smallest unit
  startTime: number; // unix timestamp (seconds)
  endTime: number; // unix timestamp (seconds)
  judgeEnd: number; // unix timestamp (seconds)
  challengeHash: Uint8Array; // SHA-256 of full challenge text
  competitionDuration: number; // seconds per agent after reveal
  refundDuration: number; // seconds after reveal for refund window
  platformAddress: string; // platform fee recipient
}

export interface EnrollParams {
  challengeId: Uint8Array;
  agentId: Uint8Array;
}

export interface PlaceBetParams {
  challengeId: Uint8Array;
  agentId: Uint8Array;
  amount: bigint;
}

export interface WithdrawParams {
  challengeId: Uint8Array;
  agentId: Uint8Array;
}

export interface VoteParams {
  challengeId: Uint8Array;
  agentId: Uint8Array;
}

export interface ChallengeOnChain {
  creator: string;
  platform: string;
  entryFee: bigint;
  startTime: number;
  endTime: number;
  judgeEnd: number;
  totalEntryPool: bigint;
  totalBetPool: bigint;
  agentCount: number;
  finalized: boolean;
  cancelled: boolean;
  winnerIndex: number;
  challengeHash: Uint8Array;
  competitionDuration: number;
  refundDuration: number;
  withdrawn: boolean[];
}

// ---------------------------------------------------------------------------
// Keypair abstraction — each chain provides its own
// ---------------------------------------------------------------------------

/** Opaque keypair type — the adapter knows how to use it. */
export type ChainKeypair = unknown;

// ---------------------------------------------------------------------------
// IEscrowAdapter interface
// ---------------------------------------------------------------------------

export interface IEscrowAdapter {
  readonly chainId: ChainId;

  createChallenge(params: CreateChallengeParams, creatorKeypair: ChainKeypair): Promise<TxResult>;

  enroll(params: EnrollParams, enrolleeKeypair: ChainKeypair): Promise<TxResult>;

  placeBet(params: PlaceBetParams, bettorKeypair: ChainKeypair): Promise<TxResult>;

  withdraw(params: WithdrawParams, agentKeypair: ChainKeypair): Promise<TxResult>;

  vote(params: VoteParams, voterKeypair: ChainKeypair): Promise<TxResult>;

  finalize(challengeId: Uint8Array, callerKeypair: ChainKeypair): Promise<TxResult>;

  claim(challengeId: Uint8Array, claimantKeypair: ChainKeypair): Promise<TxResult>;

  getChallengeState(challengeId: Uint8Array): Promise<ChallengeOnChain | null>;

  getEnrollRecord(challengeId: Uint8Array, walletAddress: string): Promise<boolean>;
}
