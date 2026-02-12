/**
 * API Route: Championship Operations
 *
 * GET /api/championship - List challenges
 * Query params:
 *   - status: "enrolling" | "competing" | "judging" | "completed" (optional)
 *
 * Response: { challenges: Challenge[] } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ChallengeStatus } from "@/app/types/frontend_type";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as ChallengeStatus | null;

    const validStatuses: ChallengeStatus[] = ["enrolling", "competing", "judging", "completed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status parameter" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("challenges")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch challenges:", error);
      return NextResponse.json(
        { error: "Failed to fetch challenges" },
        { status: 500 }
      );
    }

    // Get agent counts for each challenge
    const challenges = (data || []).map((c) => ({
      challengeId: c.challenge_id,
      creator: c.creator_wallet,
      title: c.title,
      description: c.description,
      rules: c.rules || undefined,
      enrollEnd: c.enroll_end,
      competeEnd: c.compete_end,
      judgeEnd: c.judge_end,
      status: c.status,
      escrowAddress: c.escrow_address || "",
      entryFeeDot: c.entry_fee_dot,
      totalEntryPoolDot: c.total_entry_pool_dot,
      totalBetPoolDot: c.total_bet_pool_dot,
      winnerAgentId: c.winner_agent_id || undefined,
      agentCount: 0,
    }));

    if (challenges.length > 0) {
      const challengeIds = challenges.map((c) => c.challengeId);
      const { data: agentData } = await supabaseAdmin
        .from("challenge_agents")
        .select("challenge_id")
        .in("challenge_id", challengeIds);

      if (agentData) {
        const countMap: Record<string, number> = {};
        agentData.forEach((a: { challenge_id: string }) => {
          countMap[a.challenge_id] = (countMap[a.challenge_id] || 0) + 1;
        });
        challenges.forEach((c) => {
          c.agentCount = countMap[c.challengeId] || 0;
        });
      }
    }

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error("Championship list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
