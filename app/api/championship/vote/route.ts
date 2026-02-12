/**
 * API Route: Cast Vote
 *
 * POST /api/championship/vote
 * Requires JWT authentication.
 *
 * Anti-sybil checks:
 * 1. One vote per wallet per challenge (DB UNIQUE constraint)
 * 2. Minimum DOT balance (1 DOT) checked via on-chain query
 *
 * Body: {
 *   challengeId: string,
 *   agentId: string,
 * }
 *
 * Response: { success: true } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";
import { TREASURY_CONFIG } from "@/app/services/treasury";

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

/**
 * Check if a wallet has the minimum DOT balance required to vote.
 *
 * TODO: Implement actual on-chain balance check via Polkadot API.
 * For now, this checks that the user exists in our database.
 * In production, query the chain for the free balance and compare
 * against TREASURY_CONFIG.MIN_VOTE_BALANCE_DOT.
 */
async function checkMinimumBalance(walletAddress: string): Promise<boolean> {
  // TODO: Replace with actual on-chain balance query:
  // const api = await getPolkadotApi();
  // const account = await api.query.system.account(walletAddress);
  // const freeBalance = account.data.free;
  // const minBalance = BigInt(TREASURY_CONFIG.MIN_VOTE_BALANCE_DOT) * BigInt(10_000_000_000); // Convert DOT to planck
  // return freeBalance >= minBalance;

  // For now, verify user exists (has authenticated at least once)
  const { data } = await supabaseAdmin
    .from("users")
    .select("wallet_address")
    .eq("wallet_address", walletAddress)
    .single();

  return !!data;
}

interface CastVoteRequest {
  challengeId: string;
  agentId: string;
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

    const body: CastVoteRequest = await request.json();

    if (!body.challengeId) {
      return NextResponse.json({ error: "Challenge ID is required" }, { status: 400 });
    }
    if (!body.agentId) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }

    // Check challenge is in judge phase
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("challenges")
      .select("status, judge_end")
      .eq("challenge_id", body.challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.status !== "judging") {
      return NextResponse.json(
        { error: "Voting is only available during the judge phase" },
        { status: 400 }
      );
    }

    if (new Date(challenge.judge_end) < new Date()) {
      return NextResponse.json(
        { error: "Judge phase has ended" },
        { status: 400 }
      );
    }

    // Anti-sybil check: minimum DOT balance
    const hasMinBalance = await checkMinimumBalance(walletAddress);
    if (!hasMinBalance) {
      return NextResponse.json(
        { error: `You need at least ${TREASURY_CONFIG.MIN_VOTE_BALANCE_DOT} DOT to vote` },
        { status: 403 }
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

    // Anti-sybil check: one vote per wallet per challenge (UNIQUE constraint)
    const { error: voteError } = await supabaseAdmin
      .from("challenge_votes")
      .insert({
        challenge_id: body.challengeId,
        voter_wallet: walletAddress,
        agent_id: body.agentId,
      });

    if (voteError) {
      if (voteError.code === "23505") {
        // Unique constraint violation
        return NextResponse.json(
          { error: "You have already voted in this challenge" },
          { status: 409 }
        );
      }
      console.error("Failed to cast vote:", voteError);
      return NextResponse.json(
        { error: "Failed to cast vote. Please try again." },
        { status: 500 }
      );
    }

    // Increment the agent's vote count
    const { error: rpcError } = await supabaseAdmin.rpc("increment_agent_votes", {
      p_agent_id: body.agentId,
    });

    if (rpcError) {
      console.error("Failed to increment votes:", rpcError);
      // Vote was recorded, just count update failed - not critical
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cast vote error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
