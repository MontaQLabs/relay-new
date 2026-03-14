/**
 * API Route: Enroll Agent (v2)
 *
 * POST /api/championship/enroll
 * Requires auth (JWT or API key).
 *
 * Body: {
 *   challenge_id: string,
 *   agent_name?: string,        // optional if agent has profile
 *   repo_url?: string,          // optional
 *   commit_hash?: string,       // optional
 *   endpoint_url?: string,      // optional
 *   description?: string,       // optional
 *   entry_tx_hash?: string,     // optional — auto-signed in v2
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

    // Accept both camelCase (legacy) and snake_case
    const challengeId = body.challenge_id || body.challengeId;

    if (!challengeId) {
      return NextResponse.json({ error: "challenge_id is required" }, { status: 400 });
    }

    // Check the challenge exists and is in enrollment phase
    const { data: challenge, error: challengeError } = await admin
      .from("challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Check enrollment is still open (before start_time)
    const startTime = new Date(challenge.start_time);
    if (new Date() > startTime) {
      return NextResponse.json({ error: "Enrollment period has ended" }, { status: 400 });
    }

    if (challenge.status !== "enrolling") {
      return NextResponse.json(
        { error: "Challenge is not accepting enrollments" },
        { status: 400 }
      );
    }

    // Check if user already enrolled
    const { data: existing } = await admin
      .from("challenge_agents")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("owner_wallet", auth.walletAddress)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "You have already enrolled in this challenge" },
        { status: 409 }
      );
    }

    // Resolve agent name — prefer body, fall back to agent profile or nickname
    let agentName = body.agent_name || body.agentName || "";
    if (!agentName && auth.accountType === "agent" && auth.agentId) {
      const { data: agentProfile } = await admin
        .from("agents")
        .select("agent_name")
        .eq("id", auth.agentId)
        .single();
      agentName = agentProfile?.agent_name || "Agent";
    }
    if (!agentName) {
      const { data: user } = await admin
        .from("users")
        .select("nickname")
        .eq("wallet_address", auth.walletAddress)
        .single();
      agentName = user?.nickname || auth.walletAddress.substring(0, 8);
    }

    const entryTxHash = body.entry_tx_hash || body.entryTxHash || `auto_${Date.now()}`;

    // Insert the enrollment
    const { data: agent, error: agentError } = await admin
      .from("challenge_agents")
      .insert({
        challenge_id: challengeId,
        owner_wallet: auth.walletAddress,
        agent_name: agentName,
        repo_url: body.repo_url || body.repoUrl || null,
        commit_hash: body.commit_hash || body.commitHash || null,
        endpoint_url: body.endpoint_url || body.endpointUrl || null,
        description: body.description || null,
        entry_tx_hash: entryTxHash,
        entry_verified: false,
        total_votes: 0,
        status: "enrolled",
      })
      .select("id")
      .single();

    if (agentError || !agent) {
      console.error("Failed to enroll agent:", agentError);
      return NextResponse.json({ error: "Failed to enroll agent" }, { status: 500 });
    }

    // Record entry payment via TreasuryService
    if (body.entry_tx_hash || body.entryTxHash) {
      const treasury = getTreasuryService();
      await treasury.recordEntryPayment({
        challengeId,
        walletAddress: auth.walletAddress,
        amountDot: challenge.entry_fee_dot,
        txHash: entryTxHash,
      });
    }

    return NextResponse.json({
      success: true,
      agent_id: agent.id,
    });
  } catch (error) {
    console.error("Enroll agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
