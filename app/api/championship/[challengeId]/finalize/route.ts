/**
 * API Route: Finalize Challenge
 *
 * POST /api/championship/[challengeId]/finalize
 * Requires JWT authentication. Creator only.
 *
 * Determines the winner (most votes) and triggers payout calculation/execution.
 *
 * Response: { success: true, winnerAgentId: string, payouts: PayoutResult[] } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";
import { getTreasuryService } from "@/app/services/treasury";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

async function verifyToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.wallet_address as string) || null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const { challengeId } = await params;

    // Get challenge and verify creator
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    if (challenge.creator_wallet !== walletAddress) {
      return NextResponse.json(
        { error: "Only the challenge creator can finalize" },
        { status: 403 }
      );
    }

    if (challenge.status !== "judging") {
      return NextResponse.json(
        { error: "Challenge must be in judging phase to finalize" },
        { status: 400 }
      );
    }

    if (new Date(challenge.judge_end) > new Date()) {
      return NextResponse.json(
        { error: "Judge phase has not ended yet" },
        { status: 400 }
      );
    }

    // Determine the winner (highest total_votes)
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("challenge_agents")
      .select("id, total_votes, owner_wallet")
      .eq("challenge_id", challengeId)
      .order("total_votes", { ascending: false })
      .limit(1);

    if (agentsError || !agents || agents.length === 0) {
      return NextResponse.json(
        { error: "No agents enrolled in this challenge" },
        { status: 400 }
      );
    }

    const winnerAgentId = agents[0].id;

    // Update challenge with winner and mark as completed
    const { error: updateError } = await supabaseAdmin
      .from("challenges")
      .update({
        winner_agent_id: winnerAgentId,
        status: "completed",
      })
      .eq("challenge_id", challengeId);

    if (updateError) {
      console.error("Failed to update challenge:", updateError);
      return NextResponse.json(
        { error: "Failed to finalize challenge" },
        { status: 500 }
      );
    }

    // Calculate and execute payouts via TreasuryService
    const treasury = getTreasuryService();
    let payouts;
    try {
      const payoutPlan = await treasury.calculatePayouts(challengeId);
      payouts = await treasury.executePayouts(challengeId, payoutPlan);
    } catch (payoutError) {
      console.error("Payout calculation/execution error:", payoutError);
      // Challenge is already marked completed, payouts can be retried
      return NextResponse.json({
        success: true,
        winnerAgentId,
        warning: "Challenge finalized but payout execution failed. Payouts can be retried.",
        payouts: [],
      });
    }

    return NextResponse.json({
      success: true,
      winnerAgentId,
      payouts,
    });
  } catch (error) {
    console.error("Finalize challenge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
