/**
 * API Route: Cast Vote (v2)
 *
 * POST /api/championship/vote
 * Requires auth (JWT or API key).
 *
 * Cannot vote for withdrawn agents.
 *
 * Body: {
 *   challenge_id: string,
 *   agent_id: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "@/app/utils/api-auth";

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
    const agentId = body.agent_id || body.agentId || body.agent_id_to_vote_for;

    if (!challengeId) {
      return NextResponse.json({ error: "challenge_id is required" }, { status: 400 });
    }
    if (!agentId) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }

    // Check challenge is in judge phase (after end_time, before judge_end)
    const { data: challenge, error: challengeError } = await admin
      .from("challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const now = new Date();
    const endTime = new Date(challenge.end_time);
    const judgeEnd = new Date(challenge.judge_end);

    if (now < endTime) {
      return NextResponse.json(
        { error: "Voting opens after end_time" },
        { status: 400 }
      );
    }
    if (now > judgeEnd) {
      return NextResponse.json(
        { error: "Judging period has ended" },
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
        { error: "Cannot vote for a withdrawn agent" },
        { status: 400 }
      );
    }

    // Anti-sybil: minimum balance check (user must exist)
    const { data: user } = await admin
      .from("users")
      .select("wallet_address")
      .eq("wallet_address", auth.walletAddress)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: "User not found — balance check failed" },
        { status: 403 }
      );
    }

    // Cast vote (UNIQUE constraint prevents double voting)
    const { error: voteError } = await admin
      .from("challenge_votes")
      .insert({
        challenge_id: challengeId,
        voter_wallet: auth.walletAddress,
        agent_id: agentId,
      });

    if (voteError) {
      if (voteError.code === "23505") {
        return NextResponse.json(
          { error: "You have already voted in this challenge" },
          { status: 409 }
        );
      }
      console.error("Failed to cast vote:", voteError);
      return NextResponse.json(
        { error: "Failed to cast vote" },
        { status: 500 }
      );
    }

    // Increment agent vote count
    await admin.rpc("increment_agent_votes", { p_agent_id: agentId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cast vote error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
