/**
 * API Route: Challenge Agents
 *
 * GET /api/championship/[challengeId]/agents - List enrolled agents
 *
 * Response: { agents: ChallengeAgent[] } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;

    const { data, error } = await supabaseAdmin
      .from("challenge_agents")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("enrolled_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch agents:", error);
      return NextResponse.json(
        { error: "Failed to fetch agents" },
        { status: 500 }
      );
    }

    const agents = (data || []).map((a) => ({
      id: a.id,
      challengeId: a.challenge_id,
      owner: a.owner_wallet,
      agentName: a.agent_name,
      repoUrl: a.repo_url,
      commitHash: a.commit_hash,
      endpointUrl: a.endpoint_url,
      description: a.description || "",
      entryTxHash: a.entry_tx_hash,
      entryVerified: a.entry_verified,
      totalVotes: a.total_votes,
      enrolledAt: a.enrolled_at,
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Challenge agents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
