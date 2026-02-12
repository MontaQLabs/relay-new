/**
 * API Route: Challenge Results
 *
 * GET /api/championship/[challengeId]/results - Get results and vote tallies
 *
 * Response: {
 *   agents: ChallengeAgent[],  // sorted by total votes desc
 *   winnerAgentId?: string,
 *   payouts: ChallengePayout[],
 *   totalEntryPool: string,
 *   totalBetPool: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;

    // Get challenge
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("challenges")
      .select("winner_agent_id, total_entry_pool_dot, total_bet_pool_dot, status")
      .eq("challenge_id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    // Get agents sorted by votes
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("challenge_agents")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("total_votes", { ascending: false });

    if (agentsError) {
      return NextResponse.json(
        { error: "Failed to fetch results" },
        { status: 500 }
      );
    }

    const mappedAgents = (agents || []).map((a) => ({
      id: a.id,
      challengeId: a.challenge_id,
      owner: a.owner_wallet,
      agentName: a.agent_name,
      repoUrl: a.repo_url,
      commitHash: a.commit_hash,
      endpointUrl: a.endpoint_url,
      description: a.description || "",
      entryTxHash: a.entry_tx_hash,
      entryVerified: a.entry_verified,
      totalVotes: a.total_votes,
      enrolledAt: a.enrolled_at,
    }));

    // Get payouts if challenge is completed
    let payouts: Array<{
      challengeId: string;
      recipient: string;
      amountDot: string;
      payoutType: string;
      txHash?: string;
      status: string;
    }> = [];

    if (challenge.status === "completed") {
      const { data: payoutData } = await supabaseAdmin
        .from("challenge_payouts")
        .select("*")
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: true });

      payouts = (payoutData || []).map((p) => ({
        challengeId: p.challenge_id,
        recipient: p.recipient_wallet,
        amountDot: p.amount_dot,
        payoutType: p.payout_type,
        txHash: p.tx_hash || undefined,
        status: p.status,
      }));
    }

    return NextResponse.json({
      agents: mappedAgents,
      winnerAgentId: challenge.winner_agent_id || undefined,
      payouts,
      totalEntryPool: challenge.total_entry_pool_dot,
      totalBetPool: challenge.total_bet_pool_dot,
    });
  } catch (error) {
    console.error("Challenge results error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
