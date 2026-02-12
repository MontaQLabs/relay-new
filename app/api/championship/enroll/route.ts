/**
 * API Route: Enroll Agent
 *
 * POST /api/championship/enroll
 * Requires JWT authentication.
 *
 * Body: {
 *   challengeId: string,
 *   agentName: string,
 *   repoUrl: string,       // GitHub repo URL
 *   commitHash: string,     // Pinned commit
 *   endpointUrl: string,    // Deployed API endpoint
 *   description?: string,
 *   entryTxHash: string,    // On-chain tx hash proving entry fee payment
 * }
 *
 * Response: { success: true, agentId: string } | { error: string }
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

interface EnrollAgentRequest {
  challengeId: string;
  agentName: string;
  repoUrl: string;
  commitHash: string;
  endpointUrl: string;
  description?: string;
  entryTxHash: string;
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

    const body: EnrollAgentRequest = await request.json();

    // Validate required fields
    if (!body.challengeId) {
      return NextResponse.json({ error: "Challenge ID is required" }, { status: 400 });
    }
    if (!body.agentName || body.agentName.trim() === "") {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }
    if (!body.repoUrl || !body.repoUrl.includes("github.com")) {
      return NextResponse.json({ error: "A valid GitHub repository URL is required" }, { status: 400 });
    }
    if (!body.commitHash || body.commitHash.trim() === "") {
      return NextResponse.json({ error: "Commit hash is required" }, { status: 400 });
    }
    if (!body.endpointUrl || body.endpointUrl.trim() === "") {
      return NextResponse.json({ error: "Deployed endpoint URL is required" }, { status: 400 });
    }
    if (!body.entryTxHash || body.entryTxHash.trim() === "") {
      return NextResponse.json({ error: "Entry fee transaction hash is required" }, { status: 400 });
    }

    // Check the challenge exists and is in enrollment phase
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("challenges")
      .select("status, entry_fee_dot, enroll_end")
      .eq("challenge_id", body.challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.status !== "enrolling") {
      return NextResponse.json(
        { error: "Challenge is not accepting enrollments" },
        { status: 400 }
      );
    }

    if (new Date(challenge.enroll_end) < new Date()) {
      return NextResponse.json(
        { error: "Enrollment deadline has passed" },
        { status: 400 }
      );
    }

    // Check if user already enrolled
    const { data: existing } = await supabaseAdmin
      .from("challenge_agents")
      .select("id")
      .eq("challenge_id", body.challengeId)
      .eq("owner_wallet", walletAddress)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "You have already enrolled an agent in this challenge" },
        { status: 409 }
      );
    }

    // Insert the agent
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("challenge_agents")
      .insert({
        challenge_id: body.challengeId,
        owner_wallet: walletAddress,
        agent_name: body.agentName.trim(),
        repo_url: body.repoUrl.trim(),
        commit_hash: body.commitHash.trim(),
        endpoint_url: body.endpointUrl.trim(),
        description: body.description?.trim() || null,
        entry_tx_hash: body.entryTxHash.trim(),
        entry_verified: false,
        total_votes: 0,
      })
      .select("id")
      .single();

    if (agentError || !agent) {
      console.error("Failed to enroll agent:", agentError);
      return NextResponse.json(
        { error: "Failed to enroll agent. Please try again." },
        { status: 500 }
      );
    }

    // Verify and record the entry payment via TreasuryService
    const treasury = getTreasuryService();
    const paymentResult = await treasury.recordEntryPayment({
      challengeId: body.challengeId,
      walletAddress,
      amountDot: challenge.entry_fee_dot,
      txHash: body.entryTxHash.trim(),
    });

    if (!paymentResult.verified) {
      // Agent is enrolled but payment not verified yet - it can be verified later
      console.warn("Entry payment verification pending:", paymentResult.error);
    }

    return NextResponse.json({
      success: true,
      agentId: agent.id,
    });
  } catch (error) {
    console.error("Enroll agent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
