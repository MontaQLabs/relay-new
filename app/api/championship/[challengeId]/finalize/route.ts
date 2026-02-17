/**
 * API Route: Finalize Challenge (v2)
 *
 * POST /api/championship/[challengeId]/finalize
 * Permissionless — anyone can call after judge_end.
 *
 * Determines the winner (most votes among non-withdrawn agents).
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "@/app/utils/api-auth";
import { getTreasuryService } from "@/app/services/treasury";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { challengeId } = await params;
    const admin = getAdminClient();

    const { data: challenge, error: challengeError } = await admin
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

    if (challenge.status === "completed") {
      return NextResponse.json(
        { error: "Challenge already finalized" },
        { status: 409 }
      );
    }

    const judgeEnd = new Date(challenge.judge_end);
    if (new Date() <= judgeEnd) {
      return NextResponse.json(
        { error: "Judging period has not ended yet" },
        { status: 400 }
      );
    }

    // Get all agents, determine winner among non-withdrawn
    const { data: agents, error: agentsError } = await admin
      .from("challenge_agents")
      .select("id, total_votes, owner_wallet, status")
      .eq("challenge_id", challengeId)
      .order("total_votes", { ascending: false });

    if (agentsError || !agents || agents.length === 0) {
      return NextResponse.json(
        { error: "No agents enrolled" },
        { status: 400 }
      );
    }

    // Filter non-withdrawn agents
    const activeAgents = agents.filter(
      (a: { status?: string }) => a.status !== "withdrawn"
    );

    if (activeAgents.length < 3) {
      // Too few active agents — cancel instead
      await admin
        .from("challenges")
        .update({ status: "completed" })
        .eq("challenge_id", challengeId);

      return NextResponse.json({
        success: true,
        cancelled: true,
        reason: "Fewer than 3 active agents",
      });
    }

    // Winner is the non-withdrawn agent with most votes
    const winner = activeAgents[0];

    // Update challenge
    const { error: updateError } = await admin
      .from("challenges")
      .update({
        winner_agent_id: winner.id,
        status: "completed",
      })
      .eq("challenge_id", challengeId);

    if (updateError) {
      console.error("Failed to finalize:", updateError);
      return NextResponse.json(
        { error: "Failed to finalize challenge" },
        { status: 500 }
      );
    }

    // Calculate and record payouts
    let payouts;
    try {
      const treasury = getTreasuryService();
      const plan = await treasury.calculatePayouts(challengeId);
      payouts = await treasury.executePayouts(challengeId, plan);
    } catch (payoutError) {
      console.error("Payout error:", payoutError);
      payouts = [];
    }

    return NextResponse.json({
      success: true,
      winner_agent_id: winner.id,
      payouts,
    });
  } catch (error) {
    console.error("Finalize error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
