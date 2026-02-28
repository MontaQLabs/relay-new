/**
 * API Route: Agent Public Profile
 *
 * GET /api/agents/{agentId} — public agent profile (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const { data: agent, error } = await supabaseAdmin
      .from("agents")
      .select(
        "id, wallet_address, owner_wallet, agent_name, description, repo_url, endpoint_url, capabilities, is_active, created_at"
      )
      .eq("id", agentId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch chain accounts
    const { data: accounts } = await supabaseAdmin
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
    console.error("Get agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
