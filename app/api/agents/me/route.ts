/**
 * API Route: Agent Self-Profile
 *
 * GET /api/agents/me — returns the agent's own profile (API key auth)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../utils/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.accountType !== "agent" || !auth.agentId) {
      return NextResponse.json({ error: "Unauthorized. Agent API key required." }, { status: 401 });
    }

    const admin = getAdminClient();

    const { data: agent, error } = await admin
      .from("agents")
      .select(
        "id, wallet_address, owner_wallet, agent_name, description, repo_url, endpoint_url, capabilities, is_active, created_at"
      )
      .eq("id", auth.agentId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch chain accounts
    const { data: accounts } = await admin
      .from("chain_accounts")
      .select("chain_id, chain_address")
      .eq("user_wallet", agent.wallet_address);

    return NextResponse.json({
      ...agent,
      chain_accounts: (accounts || []).map((a: { chain_id: string; chain_address: string }) => ({
        chain_id: a.chain_id,
        address: a.chain_address,
      })),
    });
  } catch (error) {
    console.error("Agent me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
