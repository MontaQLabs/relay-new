/**
 * API Route: Community Operations
 *
 * GET /api/community - List communities
 * Query params:
 *   - type: "all" | "joined" | "created" (required)
 *   - wallet: wallet address (required for joined/created)
 *
 * Response: { communities: Community[] } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DbCommunity {
  id: string;
  community_id: string;
  owner_wallet: string;
  name: string;
  description: string | null;
  avatar: string | null;
  rules: string | null;
  activity_types: string[];
  allow_investment: boolean;
  created_at: string;
}

interface DbActivity {
  activity_id: string;
}

async function getCommunityActivities(communityId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("activities")
    .select("activity_id")
    .eq("community_id", communityId);

  if (error || !data) return [];
  return data.map((a: DbActivity) => a.activity_id);
}

async function getCommunityMemberCount(communityId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("community_members")
    .select("*", { count: "exact", head: true })
    .eq("community_id", communityId);

  if (error || count === null) return 0;
  return count;
}

async function mapCommunity(c: DbCommunity) {
  const [activities, memberCount] = await Promise.all([
    getCommunityActivities(c.community_id),
    getCommunityMemberCount(c.community_id),
  ]);

  return {
    owner: c.owner_wallet,
    name: c.name,
    description: c.description || "",
    avatar: c.avatar || "",
    communityId: c.community_id,
    rules: c.rules || undefined,
    activityTypes: c.activity_types || [],
    allowInvestment: c.allow_investment ?? true,
    activities,
    memberCount,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const wallet = searchParams.get("wallet");

    if (!type || !["all", "joined", "created"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'all', 'joined', or 'created'" },
        { status: 400 }
      );
    }

    if ((type === "joined" || type === "created") && !wallet) {
      return NextResponse.json(
        { error: "Wallet address is required for joined/created communities" },
        { status: 400 }
      );
    }

    let communities: DbCommunity[] = [];

    if (type === "all") {
      const { data, error } = await supabaseAdmin
        .from("communities")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch communities:", error);
        return NextResponse.json(
          { error: "Failed to fetch communities" },
          { status: 500 }
        );
      }
      communities = data || [];
    } else if (type === "created") {
      const { data, error } = await supabaseAdmin
        .from("communities")
        .select("*")
        .eq("owner_wallet", wallet)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch created communities:", error);
        return NextResponse.json(
          { error: "Failed to fetch communities" },
          { status: 500 }
        );
      }
      communities = data || [];
    } else if (type === "joined") {
      const { data, error } = await supabaseAdmin
        .from("community_members")
        .select(`
          community_id,
          communities (*)
        `)
        .eq("user_wallet", wallet);

      if (error) {
        console.error("Failed to fetch joined communities:", error);
        return NextResponse.json(
          { error: "Failed to fetch communities" },
          { status: 500 }
        );
      }

      // Filter out communities where user is the owner (those go in "created")
      communities = (data || [])
        .filter((item) => {
          const c = item.communities as unknown as DbCommunity;
          return c && c.owner_wallet !== wallet;
        })
        .map((item) => item.communities as unknown as DbCommunity);
    }

    const mappedCommunities = await Promise.all(communities.map(mapCommunity));

    return NextResponse.json({ communities: mappedCommunities });
  } catch (error) {
    console.error("Community list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

