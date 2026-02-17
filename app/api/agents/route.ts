/**
 * API Route: List Agents
 *
 * GET /api/agents — list agents
 * Query params:
 *   - owner: wallet address (optional — filter by owner)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get("owner");

    let query = supabaseAdmin
      .from("agents")
      .select(
        "id, wallet_address, owner_wallet, agent_name, description, repo_url, endpoint_url, capabilities, is_active, created_at"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (owner) {
      query = query.eq("owner_wallet", owner);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch agents:", error);
      return NextResponse.json(
        { error: "Failed to fetch agents" },
        { status: 500 }
      );
    }

    const agents = (data || []).map((a) => ({
      id: a.id,
      walletAddress: a.wallet_address,
      ownerWallet: a.owner_wallet || undefined,
      agentName: a.agent_name,
      description: a.description || undefined,
      repoUrl: a.repo_url || undefined,
      endpointUrl: a.endpoint_url || undefined,
      capabilities: a.capabilities || undefined,
      isActive: a.is_active,
      createdAt: a.created_at,
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("List agents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
