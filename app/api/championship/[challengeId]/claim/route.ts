/**
 * API Route: Claim Payout
 *
 * POST /api/championship/{challengeId}/claim
 * Requires auth (API key or JWT).
 *
 * Claims winnings after finalization, or refunds after cancellation.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../../utils/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challengeId } = await params;
    const admin = getAdminClient();

    // Get challenge
    const { data: challenge, error: chErr } = await admin
      .from("challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .single();

    if (chErr || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.status !== "completed") {
      return NextResponse.json({ error: "Challenge is not yet finalized" }, { status: 403 });
    }

    // Check if already claimed
    const { data: existingPayout } = await admin
      .from("challenge_payouts")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("recipient_wallet", auth.walletAddress)
      .in("payout_type", ["entry_prize", "bet_winnings"])
      .limit(1);

    if (existingPayout && existingPayout.length > 0) {
      return NextResponse.json({ error: "Already claimed" }, { status: 409 });
    }

    // TODO: Execute on-chain claim via escrow adapter
    // For now, calculate and record the payout

    let payout = BigInt(0);
    const payoutEntries: { payout_type: string; amount: string }[] = [];

    // Check if this user is the winner agent owner
    if (challenge.winner_agent_id) {
      const { data: winnerAgent } = await admin
        .from("challenge_agents")
        .select("owner_wallet")
        .eq("id", challenge.winner_agent_id)
        .single();

      if (winnerAgent && winnerAgent.owner_wallet === auth.walletAddress) {
        const entryPool = BigInt(challenge.total_entry_pool_dot);
        const winnerShare = (entryPool * BigInt(95)) / BigInt(100);
        payout += winnerShare;
        payoutEntries.push({
          payout_type: "entry_prize",
          amount: winnerShare.toString(),
        });
      }
    }

    // Check if this user is the creator
    if (auth.walletAddress === challenge.creator_wallet) {
      const entryPool = BigInt(challenge.total_entry_pool_dot);
      const betPool = BigInt(challenge.total_bet_pool_dot);
      const creatorEntry = (entryPool * BigInt(4)) / BigInt(100);
      const creatorBet = (betPool * BigInt(2)) / BigInt(100);
      const creatorTotal = creatorEntry + creatorBet;
      if (creatorTotal > BigInt(0)) {
        payout += creatorTotal;
        payoutEntries.push({
          payout_type: "entry_prize",
          amount: creatorTotal.toString(),
        });
      }
    }

    // Check bet winnings (if bet on winner)
    if (challenge.winner_agent_id) {
      const { data: userBets } = await admin
        .from("challenge_bets")
        .select("amount_dot")
        .eq("challenge_id", challengeId)
        .eq("bettor_wallet", auth.walletAddress)
        .eq("agent_id", challenge.winner_agent_id)
        .eq("verified", true);

      if (userBets && userBets.length > 0) {
        const userBetTotal = userBets.reduce(
          (sum: bigint, b: { amount_dot: string }) => sum + BigInt(b.amount_dot),
          BigInt(0)
        );

        if (userBetTotal > BigInt(0)) {
          // Get total bets on winner
          const { data: allWinnerBets } = await admin
            .from("challenge_bets")
            .select("amount_dot")
            .eq("challenge_id", challengeId)
            .eq("agent_id", challenge.winner_agent_id)
            .eq("verified", true);

          const totalWinnerBets = (allWinnerBets || []).reduce(
            (sum: bigint, b: { amount_dot: string }) => sum + BigInt(b.amount_dot),
            BigInt(0)
          );

          if (totalWinnerBets > BigInt(0)) {
            const betPool = BigInt(challenge.total_bet_pool_dot);
            const winnerBetPool = (betPool * BigInt(95)) / BigInt(100);
            const userShare = (winnerBetPool * userBetTotal) / totalWinnerBets;
            if (userShare > BigInt(0)) {
              payout += userShare;
              payoutEntries.push({
                payout_type: "bet_winnings",
                amount: userShare.toString(),
              });
            }
          }
        }
      }
    }

    if (payout === BigInt(0)) {
      return NextResponse.json({ error: "Nothing to claim" }, { status: 400 });
    }

    // Record payouts
    for (const entry of payoutEntries) {
      await admin.from("challenge_payouts").insert({
        challenge_id: challengeId,
        recipient_wallet: auth.walletAddress,
        amount_dot: entry.amount,
        payout_type: entry.payout_type,
        status: "pending",
      });
    }

    return NextResponse.json({
      success: true,
      total_payout: payout.toString(),
      payouts: payoutEntries,
    });
  } catch (error) {
    console.error("Claim error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
