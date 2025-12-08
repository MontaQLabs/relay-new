/**
 * API Route: Search Communities
 *
 * GET /api/community/search
 * Query params:
 *   - q: string (required) - search term
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
    const query = searchParams.get("q");

    if (!query || query.trim() === "") {
      return NextResponse.json({ communities: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("communities")
      .select("*")
      .ilike("name", `%${query.trim()}%`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to search communities:", error);
      return NextResponse.json(
        { error: "Failed to search communities" },
        { status: 500 }
      );
    }

    const communities = await Promise.all((data || []).map(mapCommunity));

    return NextResponse.json({ communities });
  } catch (error) {
    console.error("Search communities error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

