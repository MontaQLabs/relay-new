/**
 * API Route: Regenerate Claim Token
 *
 * POST /api/agents/me/regenerate-claim-token
 * Requires agent API key auth. Only works if agent is unclaimed.
 *
 * Response: { claim_token: "rly_ct_..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../../utils/api-auth";
import { generateToken, sha256 } from "../../../../utils/championship-crypto";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.accountType !== "agent" || !auth.agentId) {
      return NextResponse.json({ error: "Unauthorized. Agent API key required." }, { status: 401 });
    }

    const admin = getAdminClient();

    // Check if agent is claimed
    const { data: agent, error } = await admin
      .from("agents")
      .select("id, owner_wallet")
      .eq("id", auth.agentId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.owner_wallet) {
      return NextResponse.json(
        { error: "Cannot regenerate claim token — agent already claimed" },
        { status: 409 }
      );
    }

    const claimToken = generateToken("rly_ct_");
    const claimTokenHash = sha256(claimToken);

    const { error: updateError } = await admin
      .from("agents")
      .update({ claim_token_hash: claimTokenHash })
      .eq("id", auth.agentId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to regenerate claim token" }, { status: 500 });
    }

    return NextResponse.json({ claim_token: claimToken });
  } catch (error) {
    console.error("Regenerate claim token error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
