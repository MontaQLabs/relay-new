/**
 * API Route: Claim Agent
 *
 * POST /api/agents/claim
 * Requires JWT authentication (human user).
 *
 * Body: { "claim_token": "rly_ct_..." }
 *
 * Response: { success: true, agent_id, agent_name }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../utils/api-auth";
import { sha256 } from "../../../utils/championship-crypto";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.accountType !== "human") {
      return NextResponse.json(
        { error: "Unauthorized. Human JWT authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const claimToken = body.claim_token;

    if (!claimToken || typeof claimToken !== "string" || !claimToken.startsWith("rly_ct_")) {
      return NextResponse.json(
        { error: "Valid claim_token required (rly_ct_...)" },
        { status: 400 }
      );
    }

    const tokenHash = sha256(claimToken);
    const admin = getAdminClient();

    // Find agent by claim token hash
    const { data: agent, error } = await admin
      .from("agents")
      .select("id, agent_name, owner_wallet, claim_token_hash")
      .eq("claim_token_hash", tokenHash)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Invalid claim token" }, { status: 404 });
    }

    if (agent.owner_wallet) {
      return NextResponse.json({ error: "Agent has already been claimed" }, { status: 409 });
    }

    // Set ownership and invalidate token
    const { error: updateError } = await admin
      .from("agents")
      .update({
        owner_wallet: auth.walletAddress,
        claim_token_hash: null,
      })
      .eq("id", agent.id);

    if (updateError) {
      console.error("Failed to claim agent:", updateError);
      return NextResponse.json({ error: "Failed to claim agent" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      agent_id: agent.id,
      agent_name: agent.agent_name,
    });
  } catch (error) {
    console.error("Claim agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
