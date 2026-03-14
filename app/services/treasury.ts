/**
 * TreasuryService - Smart Contract Portability Layer
 *
 * All financial operations (entry fees, bets, payouts) are routed through
 * the ITreasuryService interface. This isolates financial logic so that
 * swapping from Supabase + on-chain verification to a smart contract
 * requires only replacing the implementation, not the callers.
 *
 * Current implementation: SupabaseTreasuryService
 * Future migration: SmartContractTreasuryService (ink! contracts)
 */

import { getSupabaseClient } from "../db/supabase";
import type { ChallengeBet } from "../types/frontend_type";

// ============================================================================
// Configuration Constants (will become smart contract parameters)
// ============================================================================

export const TREASURY_CONFIG = {
  ENTRY_WINNER_SHARE: 0.95, // 95% of entry pool to winners
  ENTRY_PLATFORM_SHARE: 0.05, // 5% platform fee on entries
  BET_WINNER_SHARE: 0.98, // 98% of bet pool to winning bettors
  BET_PLATFORM_SHARE: 0.02, // 2% platform fee on bets
  PLATFORM_WALLET: process.env.PLATFORM_WALLET_ADDRESS || "",
  MIN_VOTE_BALANCE_DOT: "1", // Minimum DOT balance to vote (1 DOT)
} as const;

// ============================================================================
// Interfaces (shared between all implementations)
// ============================================================================

export interface PayoutEntry {
  wallet: string;
  amount: string;
}

export interface PayoutPlan {
  entryPrize: PayoutEntry; // 95% of entry pool to winner
  platformEntryFee: PayoutEntry; // 5% to platform
  betWinnings: PayoutEntry[]; // 98% split proportionally among winning bettors
  platformBetFee: PayoutEntry; // 2% to platform
}

export interface PayoutResult {
  wallet: string;
  amount: string;
  payoutType: "entry_prize" | "bet_winnings" | "platform_entry_fee" | "platform_bet_fee";
  txHash?: string;
  status: "pending" | "completed" | "failed";
  error?: string;
}

export interface ITreasuryService {
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

  // Payouts (called after judging)
  calculatePayouts(challengeId: string): Promise<PayoutPlan>;
  executePayouts(challengeId: string, plan: PayoutPlan): Promise<PayoutResult[]>;

  // Queries
  getEntryPool(challengeId: string): Promise<string>;
  getBetPool(challengeId: string): Promise<string>;
  getUserBets(challengeId: string, wallet: string): Promise<ChallengeBet[]>;
}

// ============================================================================
// BigInt-safe arithmetic helpers (DOT amounts as strings)
// ============================================================================

function addDot(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

function multiplyDotByFraction(amount: string, numerator: number, denominator: number): string {
  // Multiply first, then divide to minimize precision loss
  return (
    (BigInt(amount) * BigInt(Math.round(numerator * 1_000_000))) /
    BigInt(Math.round(denominator * 1_000_000))
  ).toString();
}

// ============================================================================
// Supabase Implementation (current)
// ============================================================================

export class SupabaseTreasuryService implements ITreasuryService {
  /**
   * Record and verify an entry fee payment.
   * Updates total_entry_pool_dot and marks the agent's entry as verified.
   */
  async recordEntryPayment(params: {
    challengeId: string;
    walletAddress: string;
    amountDot: string;
    txHash: string;
  }): Promise<{ verified: boolean; error?: string }> {
    const client = getSupabaseClient();

    // Get the challenge to find the escrow address and entry fee
    const { data: challenge, error: challengeError } = await client
      .from("challenges")
      .select("escrow_address, entry_fee_dot, total_entry_pool_dot, status")
      .eq("challenge_id", params.challengeId)
      .single();

    if (challengeError || !challenge) {
      return { verified: false, error: "Challenge not found" };
    }

    if (challenge.status !== "enrolling") {
      return { verified: false, error: "Challenge is not in enrollment phase" };
    }

    if (params.amountDot !== challenge.entry_fee_dot) {
      return { verified: false, error: `Entry fee must be exactly ${challenge.entry_fee_dot} DOT` };
    }

    // Verify the on-chain transfer
    const verified = await this.verifyOnChainTransfer({
      txHash: params.txHash,
      expectedSender: params.walletAddress,
      expectedDestination: challenge.escrow_address || "",
      expectedAmount: params.amountDot,
    });

    if (!verified) {
      return { verified: false, error: "On-chain transfer verification failed" };
    }

    // Update the agent's entry_verified status
    const { error: agentError } = await client
      .from("challenge_agents")
      .update({ entry_verified: true })
      .eq("challenge_id", params.challengeId)
      .eq("owner_wallet", params.walletAddress);

    if (agentError) {
      return { verified: false, error: "Failed to update agent verification status" };
    }

    // Update the total entry pool
    const newPool = addDot(challenge.total_entry_pool_dot, params.amountDot);
    const { error: poolError } = await client
      .from("challenges")
      .update({ total_entry_pool_dot: newPool })
      .eq("challenge_id", params.challengeId);

    if (poolError) {
      return { verified: false, error: "Failed to update entry pool" };
    }

    return { verified: true };
  }

  /**
   * Record and verify a bet payment.
   * Updates total_bet_pool_dot.
   */
  async recordBet(params: {
    challengeId: string;
    walletAddress: string;
    agentId: string;
    amountDot: string;
    txHash: string;
  }): Promise<{ verified: boolean; error?: string }> {
    const client = getSupabaseClient();

    // Get the challenge
    const { data: challenge, error: challengeError } = await client
      .from("challenges")
      .select("escrow_address, total_bet_pool_dot, status")
      .eq("challenge_id", params.challengeId)
      .single();

    if (challengeError || !challenge) {
      return { verified: false, error: "Challenge not found" };
    }

    if (challenge.status !== "competing") {
      return { verified: false, error: "Challenge is not in compete phase" };
    }

    // Verify the on-chain transfer
    const verified = await this.verifyOnChainTransfer({
      txHash: params.txHash,
      expectedSender: params.walletAddress,
      expectedDestination: challenge.escrow_address || "",
      expectedAmount: params.amountDot,
    });

    if (!verified) {
      return { verified: false, error: "On-chain transfer verification failed" };
    }

    // Record the bet
    const { error: betError } = await client.from("challenge_bets").insert({
      challenge_id: params.challengeId,
      bettor_wallet: params.walletAddress,
      agent_id: params.agentId,
      amount_dot: params.amountDot,
      tx_hash: params.txHash,
      verified: true,
    });

    if (betError) {
      return { verified: false, error: "Failed to record bet" };
    }

    // Update the total bet pool
    const newPool = addDot(challenge.total_bet_pool_dot, params.amountDot);
    const { error: poolError } = await client
      .from("challenges")
      .update({ total_bet_pool_dot: newPool })
      .eq("challenge_id", params.challengeId);

    if (poolError) {
      return { verified: false, error: "Failed to update bet pool" };
    }

    return { verified: true };
  }

  /**
   * Verify an on-chain DOT transfer via Polkadot API.
   *
   * TODO: Implement actual on-chain verification using polkadot-api.
   * For now, this is a placeholder that accepts all transfers.
   * In production, this should:
   * 1. Query the chain for the transaction by hash
   * 2. Verify sender, destination, and amount match
   * 3. Verify the transaction is finalized
   */
  async verifyOnChainTransfer(params: {
    txHash: string;
    expectedSender: string;
    expectedDestination: string;
    expectedAmount: string;
  }): Promise<boolean> {
    // TODO: Implement actual on-chain verification
    // For MVP, we trust the tx_hash provided by the client.
    // The escrow wallet balance can be audited separately.
    console.log("Verifying on-chain transfer:", params.txHash);
    return params.txHash.length > 0;
  }

  /**
   * Calculate the payout plan for a completed challenge.
   * Entry pool: 95% winner, 5% platform
   * Bet pool: 98% to winning bettors (proportional), 2% platform
   */
  async calculatePayouts(challengeId: string): Promise<PayoutPlan> {
    const client = getSupabaseClient();

    // Get challenge details
    const { data: challenge, error: challengeError } = await client
      .from("challenges")
      .select("total_entry_pool_dot, total_bet_pool_dot, winner_agent_id")
      .eq("challenge_id", challengeId)
      .single();

    if (challengeError || !challenge || !challenge.winner_agent_id) {
      throw new Error("Challenge not found or no winner set");
    }

    // Get winner's wallet
    const { data: winnerAgent, error: agentError } = await client
      .from("challenge_agents")
      .select("owner_wallet")
      .eq("id", challenge.winner_agent_id)
      .single();

    if (agentError || !winnerAgent) {
      throw new Error("Winner agent not found");
    }

    // Calculate entry pool split
    const entryPool = challenge.total_entry_pool_dot;
    const entryPrizeAmount = multiplyDotByFraction(
      entryPool,
      TREASURY_CONFIG.ENTRY_WINNER_SHARE,
      1
    );
    const platformEntryAmount = multiplyDotByFraction(
      entryPool,
      TREASURY_CONFIG.ENTRY_PLATFORM_SHARE,
      1
    );

    // Calculate bet pool split
    const betPool = challenge.total_bet_pool_dot;
    const betWinnerPool = multiplyDotByFraction(betPool, TREASURY_CONFIG.BET_WINNER_SHARE, 1);
    const platformBetAmount = multiplyDotByFraction(betPool, TREASURY_CONFIG.BET_PLATFORM_SHARE, 1);

    // Get all verified bets on the winning agent
    const { data: winningBets, error: betsError } = await client
      .from("challenge_bets")
      .select("bettor_wallet, amount_dot")
      .eq("challenge_id", challengeId)
      .eq("agent_id", challenge.winner_agent_id)
      .eq("verified", true);

    if (betsError) {
      throw new Error("Failed to fetch winning bets");
    }

    // Calculate total amount bet on the winner
    const totalWinningBets = (winningBets || []).reduce(
      (sum, bet) => addDot(sum, bet.amount_dot),
      "0"
    );

    // Calculate proportional payouts for each winning bettor
    const betWinnings: PayoutEntry[] = [];
    if (BigInt(totalWinningBets) > BigInt(0)) {
      for (const bet of winningBets || []) {
        // payout = betWinnerPool * (bet.amount / totalWinningBets)
        const payout = (
          (BigInt(betWinnerPool) * BigInt(bet.amount_dot)) /
          BigInt(totalWinningBets)
        ).toString();

        if (BigInt(payout) > BigInt(0)) {
          // Merge payouts for same wallet
          const existing = betWinnings.find((w) => w.wallet === bet.bettor_wallet);
          if (existing) {
            existing.amount = addDot(existing.amount, payout);
          } else {
            betWinnings.push({ wallet: bet.bettor_wallet, amount: payout });
          }
        }
      }
    }

    return {
      entryPrize: { wallet: winnerAgent.owner_wallet, amount: entryPrizeAmount },
      platformEntryFee: { wallet: TREASURY_CONFIG.PLATFORM_WALLET, amount: platformEntryAmount },
      betWinnings,
      platformBetFee: { wallet: TREASURY_CONFIG.PLATFORM_WALLET, amount: platformBetAmount },
    };
  }

  /**
   * Execute the payout plan by recording each payout in the database.
   *
   * TODO: Implement actual on-chain transfers from the escrow wallet.
   * For now, payouts are recorded as 'pending' for manual execution.
   */
  async executePayouts(challengeId: string, plan: PayoutPlan): Promise<PayoutResult[]> {
    const client = getSupabaseClient();
    const results: PayoutResult[] = [];

    // Helper to record a single payout
    const recordPayout = async (
      wallet: string,
      amount: string,
      payoutType: PayoutResult["payoutType"]
    ): Promise<PayoutResult> => {
      if (BigInt(amount) <= BigInt(0)) {
        return { wallet, amount, payoutType, status: "completed" };
      }

      const { error } = await client.from("challenge_payouts").insert({
        challenge_id: challengeId,
        recipient_wallet: wallet,
        amount_dot: amount,
        payout_type: payoutType,
        status: "pending",
      });

      if (error) {
        return { wallet, amount, payoutType, status: "failed", error: error.message };
      }

      // TODO: Execute actual on-chain transfer here and update status to 'completed'
      return { wallet, amount, payoutType, status: "pending" };
    };

    // Record entry prize payout
    results.push(await recordPayout(plan.entryPrize.wallet, plan.entryPrize.amount, "entry_prize"));

    // Record platform entry fee
    results.push(
      await recordPayout(
        plan.platformEntryFee.wallet,
        plan.platformEntryFee.amount,
        "platform_entry_fee"
      )
    );

    // Record bet winnings for each winning bettor
    for (const betWinning of plan.betWinnings) {
      results.push(await recordPayout(betWinning.wallet, betWinning.amount, "bet_winnings"));
    }

    // Record platform bet fee
    results.push(
      await recordPayout(plan.platformBetFee.wallet, plan.platformBetFee.amount, "platform_bet_fee")
    );

    return results;
  }

  /**
   * Get the total entry pool for a challenge.
   */
  async getEntryPool(challengeId: string): Promise<string> {
    const { data, error } = await getSupabaseClient()
      .from("challenges")
      .select("total_entry_pool_dot")
      .eq("challenge_id", challengeId)
      .single();

    if (error || !data) return "0";
    return data.total_entry_pool_dot;
  }

  /**
   * Get the total bet pool for a challenge.
   */
  async getBetPool(challengeId: string): Promise<string> {
    const { data, error } = await getSupabaseClient()
      .from("challenges")
      .select("total_bet_pool_dot")
      .eq("challenge_id", challengeId)
      .single();

    if (error || !data) return "0";
    return data.total_bet_pool_dot;
  }

  /**
   * Get all bets placed by a user on a challenge.
   */
  async getUserBets(challengeId: string, wallet: string): Promise<ChallengeBet[]> {
    const { data, error } = await getSupabaseClient()
      .from("challenge_bets")
      .select("*")
      .eq("challenge_id", challengeId)
      .eq("bettor_wallet", wallet)
      .order("placed_at", { ascending: false });

    if (error || !data) return [];

    return data.map((b) => ({
      id: b.id,
      challengeId: b.challenge_id,
      bettor: b.bettor_wallet,
      agentId: b.agent_id,
      amountDot: b.amount_dot,
      txHash: b.tx_hash,
      verified: b.verified,
      placedAt: b.placed_at,
    }));
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let treasuryInstance: ITreasuryService | null = null;

export function getTreasuryService(): ITreasuryService {
  if (!treasuryInstance) {
    treasuryInstance = new SupabaseTreasuryService();
  }
  return treasuryInstance;
}
