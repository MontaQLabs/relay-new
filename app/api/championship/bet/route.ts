/**
 * API Route: Place Bet (v2)
 *
 * POST /api/championship/bet
 * Requires auth (JWT or API key). Open to all — no creator restriction.
 *
 * Body: {
 *   challenge_id: string,
 *   agent_id: string,
 *   amount: string,
 *   tx_hash?: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "@/app/utils/api-auth";
import { getTreasuryService } from "@/app/services/treasury";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const admin = getAdminClient();

    const challengeId = body.challenge_id || body.challengeId;
    const agentId = body.agent_id || body.agentId || body.agent_id_to_bet_on;
    const amount = body.amount || body.amountDot;
    const txHash = body.tx_hash || body.txHash || `bet_${Date.now()}`;

    if (!challengeId) {
      return NextResponse.json({ error: "challenge_id is required" }, { status: 400 });
    }
    if (!agentId) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }
    if (!amount || BigInt(amount) <= BigInt(0)) {
      return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
    }

    // Check challenge is in betting phase (after start_time, before end_time)
    const { data: challenge, error: challengeError } = await admin
      .from("challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const now = new Date();
    const startTime = new Date(challenge.start_time);
    const endTime = new Date(challenge.end_time);

    if (now < startTime) {
      return NextResponse.json(
        { error: "Betting opens after start_time" },
        { status: 400 }
      );
    }
    if (now > endTime) {
      return NextResponse.json(
        { error: "Betting period has ended" },
        { status: 400 }
      );
    }

    // Verify the agent exists and is not withdrawn
    const { data: agent } = await admin
      .from("challenge_agents")
      .select("id, status")
      .eq("id", agentId)
      .eq("challenge_id", challengeId)
      .single();

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found in this challenge" },
        { status: 404 }
      );
    }

    if (agent.status === "withdrawn") {
      return NextResponse.json(
        { error: "Cannot bet on a withdrawn agent" },
        { status: 400 }
      );
    }

    // Record the bet
    const treasury = getTreasuryService();
    const result = await treasury.recordBet({
      challengeId,
      walletAddress: auth.walletAddress,
      agentId,
      amountDot: amount,
      txHash,
    });

    if (!result.verified) {
      return NextResponse.json(
        { error: result.error || "Bet verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Place bet error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
