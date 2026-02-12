/**
 * API Route: Challenge Bet Stats
 *
 * GET /api/championship/[challengeId]/bets - Get bet pool stats
 * Query params:
 *   - wallet: (optional) filter by bettor wallet
 *
 * Response: { totalPool: string, bets: ChallengeBet[], betsByAgent: Record<string, string> }
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
    const wallet = request.nextUrl.searchParams.get("wallet");

    // Get total pool
    const { data: challenge } = await supabaseAdmin
      .from("challenges")
      .select("total_bet_pool_dot")
      .eq("challenge_id", challengeId)
      .single();

    // Get bets (optionally filtered by wallet)
    let query = supabaseAdmin
      .from("challenge_bets")
      .select("*")
      .eq("challenge_id", challengeId)
      .eq("verified", true)
      .order("placed_at", { ascending: false });

    if (wallet) {
      query = query.eq("bettor_wallet", wallet);
    }

    const { data: bets, error } = await query;

    if (error) {
      console.error("Failed to fetch bets:", error);
      return NextResponse.json(
        { error: "Failed to fetch bets" },
        { status: 500 }
      );
    }

    // Calculate bets by agent
    const betsByAgent: Record<string, string> = {};
    (bets || []).forEach((b) => {
      const current = BigInt(betsByAgent[b.agent_id] || "0");
      betsByAgent[b.agent_id] = (current + BigInt(b.amount_dot)).toString();
    });

    const mappedBets = (bets || []).map((b) => ({
      id: b.id,
      challengeId: b.challenge_id,
      bettor: b.bettor_wallet,
      agentId: b.agent_id,
      amountDot: b.amount_dot,
      txHash: b.tx_hash,
      verified: b.verified,
      placedAt: b.placed_at,
    }));

    return NextResponse.json({
      totalPool: challenge?.total_bet_pool_dot || "0",
      bets: mappedBets,
      betsByAgent,
    });
  } catch (error) {
    console.error("Bet stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
