/**
 * API Route: Challenge Detail
 *
 * GET /api/championship/[challengeId] - Get a single challenge
 *
 * Response: { challenge: Challenge } | { error: string }
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

    const { data, error } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    // Get agent count
    const { count } = await supabaseAdmin
      .from("challenge_agents")
      .select("*", { count: "exact", head: true })
      .eq("challenge_id", challengeId);

    const challenge = {
      challengeId: data.challenge_id,
      creator: data.creator_wallet,
      title: data.title,
      description: data.description,
      rules: data.rules || undefined,
      enrollEnd: data.enroll_end,
      competeEnd: data.compete_end,
      judgeEnd: data.judge_end,
      status: data.status,
      escrowAddress: data.escrow_address || "",
      entryFeeDot: data.entry_fee_dot,
      totalEntryPoolDot: data.total_entry_pool_dot,
      totalBetPoolDot: data.total_bet_pool_dot,
      winnerAgentId: data.winner_agent_id || undefined,
      agentCount: count || 0,
    };

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error("Challenge detail error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
