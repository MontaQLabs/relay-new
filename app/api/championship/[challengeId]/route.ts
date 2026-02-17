/**
 * API Route: Challenge Detail
 *
 * GET /api/championship/[challengeId] - Get a single challenge
 *
 * Two-phase visibility:
 *   - Before start_time: abstract description only, full challenge hidden
 *   - After start_time: full challenge visible (decrypted)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptChallenge } from "@/app/utils/championship-crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
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

    const now = new Date();
    const isAfterStart = now >= new Date(data.start_time);

    // Decrypt full challenge only if after start_time
    let fullChallenge: string | undefined;
    if (isAfterStart && data.full_challenge_encrypted) {
      try {
        fullChallenge = decryptChallenge(data.full_challenge_encrypted);
      } catch {
        fullChallenge = undefined;
      }
    }

    const challenge = {
      challengeId: data.challenge_id,
      creator: data.creator_wallet,
      title: data.title,
      description: data.abstract_description || data.description,
      abstractDescription: data.abstract_description || data.description,
      fullChallenge: fullChallenge,
      rules: data.rules || undefined,
      categories: data.categories || undefined,
      chainId: data.chain_id || "solana",
      challengeHash: data.challenge_hash || undefined,
      startTime: data.start_time,
      endTime: data.end_time,
      judgeEnd: data.judge_end,
      competitionDurationSeconds: data.competition_duration_seconds || undefined,
      refundWindowSeconds: data.refund_window_seconds || undefined,
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
