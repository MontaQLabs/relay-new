/**
 * API Route: Place Bet
 *
 * POST /api/championship/bet
 * Requires JWT authentication.
 *
 * Body: {
 *   challengeId: string,
 *   agentId: string,       // UUID of the agent to bet on
 *   amountDot: string,     // DOT amount as string
 *   txHash: string,        // On-chain transaction hash
 * }
 *
 * Response: { success: true } | { error: string }
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

interface PlaceBetRequest {
  challengeId: string;
  agentId: string;
  amountDot: string;
  txHash: string;
}

export async function POST(request: NextRequest) {
  try {
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const body: PlaceBetRequest = await request.json();

    // Validate required fields
    if (!body.challengeId) {
      return NextResponse.json({ error: "Challenge ID is required" }, { status: 400 });
    }
    if (!body.agentId) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }
    if (!body.amountDot || BigInt(body.amountDot) <= BigInt(0)) {
      return NextResponse.json({ error: "Bet amount must be positive" }, { status: 400 });
    }
    if (!body.txHash || body.txHash.trim() === "") {
      return NextResponse.json({ error: "Transaction hash is required" }, { status: 400 });
    }

    // Verify challenge is in compete phase
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("challenges")
      .select("status, compete_end")
      .eq("challenge_id", body.challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.status !== "competing") {
      return NextResponse.json(
        { error: "Betting is only available during the compete phase" },
        { status: 400 }
      );
    }

    if (new Date(challenge.compete_end) < new Date()) {
      return NextResponse.json(
        { error: "Compete phase has ended" },
        { status: 400 }
      );
    }

    // Verify the agent exists in this challenge
    const { data: agent } = await supabaseAdmin
      .from("challenge_agents")
      .select("id")
      .eq("id", body.agentId)
      .eq("challenge_id", body.challengeId)
      .single();

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found in this challenge" },
        { status: 404 }
      );
    }

    // Record the bet via TreasuryService
    const treasury = getTreasuryService();
    const result = await treasury.recordBet({
      challengeId: body.challengeId,
      walletAddress,
      agentId: body.agentId,
      amountDot: body.amountDot,
      txHash: body.txHash.trim(),
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
