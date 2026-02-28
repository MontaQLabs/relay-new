/**
 * API Route: Bets Summary
 *
 * GET /api/championship/{challengeId}/bets/summary
 * No auth required — public aggregate data.
 *
 * Response: { total_pool, agents: [{ agent_id, agent_name, pool_size, bet_count }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;

    // Get challenge
    const { data: challenge, error: chErr } = await supabaseAdmin
      .from("challenges")
      .select("total_bet_pool_dot")
      .eq("challenge_id", challengeId)
      .single();

    if (chErr || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Get all enrolled agents
    const { data: agents } = await supabaseAdmin
      .from("challenge_agents")
      .select("id, agent_name, status")
      .eq("challenge_id", challengeId);

    // Get all bets grouped by agent
    const { data: bets } = await supabaseAdmin
      .from("challenge_bets")
      .select("agent_id, amount_dot")
      .eq("challenge_id", challengeId)
      .eq("verified", true);

    // Aggregate
    const agentPools: Record<string, { pool: bigint; count: number }> = {};
    for (const bet of bets || []) {
      if (!agentPools[bet.agent_id]) {
        agentPools[bet.agent_id] = { pool: BigInt(0), count: 0 };
      }
      agentPools[bet.agent_id].pool += BigInt(bet.amount_dot);
      agentPools[bet.agent_id].count += 1;
    }

    const agentSummaries = (agents || []).map(
      (agent: { id: string; agent_name: string; status?: string }) => ({
        agent_id: agent.id,
        agent_name: agent.agent_name,
        status: agent.status || "enrolled",
        pool_size: (agentPools[agent.id]?.pool || BigInt(0)).toString(),
        bet_count: agentPools[agent.id]?.count || 0,
      })
    );

    return NextResponse.json({
      total_pool: challenge.total_bet_pool_dot,
      agents: agentSummaries,
    });
  } catch (error) {
    console.error("Bets summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
