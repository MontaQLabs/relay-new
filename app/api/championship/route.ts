/**
 * API Route: Championship Operations
 *
 * GET /api/championship - List challenges
 * Query params:
 *   - status: "enrolling" | "competing" | "judging" | "completed" (optional)
 *   - chain_id: "solana" | "base" | "near" | ... (optional)
 *   - category: string (optional)
 *
 * Two-phase visibility:
 *   - Before start_time: only abstract description visible
 *   - After start_time: full challenge visible (decrypted)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";
import type { ChallengeStatus } from "@/app/types/frontend_type";
import { decryptChallenge } from "@/app/utils/championship-crypto";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as ChallengeStatus | null;
    const chainId = searchParams.get("chain_id");
    const category = searchParams.get("category");

    const validStatuses: ChallengeStatus[] = ["enrolling", "competing", "judging", "completed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status parameter" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("challenges")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (chainId) query = query.eq("chain_id", chainId);
    if (category) query = query.contains("categories", [category]);

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch challenges:", error);
      return NextResponse.json({ error: "Failed to fetch challenges" }, { status: 500 });
    }

    const now = new Date();

    const challenges = (data || []).map((c) => {
      const isAfterStart = now >= new Date(c.start_time);

      // Decrypt full challenge only if after start_time
      let fullChallenge: string | undefined;
      if (isAfterStart && c.full_challenge_encrypted) {
        try {
          fullChallenge = decryptChallenge(c.full_challenge_encrypted);
        } catch {
          fullChallenge = undefined;
        }
      }

      return {
        challengeId: c.challenge_id,
        creator: c.creator_wallet,
        title: c.title,
        description: c.abstract_description || c.description,
        abstractDescription: c.abstract_description || c.description,
        fullChallenge: fullChallenge,
        rules: c.rules || undefined,
        categories: c.categories || undefined,
        chainId: c.chain_id || "solana",
        challengeHash: c.challenge_hash || undefined,
        startTime: c.start_time,
        endTime: c.end_time,
        judgeEnd: c.judge_end,
        competitionDurationSeconds: c.competition_duration_seconds || undefined,
        refundWindowSeconds: c.refund_window_seconds || undefined,
        status: c.status,
        escrowAddress: c.escrow_address || "",
        entryFeeDot: c.entry_fee_dot,
        totalEntryPoolDot: c.total_entry_pool_dot,
        totalBetPoolDot: c.total_bet_pool_dot,
        winnerAgentId: c.winner_agent_id || undefined,
        agentCount: 0,
      };
    });

    // Batch fetch agent counts
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
