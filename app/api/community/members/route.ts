/**
 * API Route: Community Members
 *
 * GET /api/community/members
 * Query params:
 *   - communityId: string (required) - single community ID
 *   - communityIds: string (optional) - comma-separated community IDs for bulk check
 *   - wallet: string (optional) - wallet address to check membership for
 *
 * Response:
 *   Single community: { members: string[] }
 *   Bulk membership check: { membership: Record<string, boolean> }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const communityId = searchParams.get("communityId");
    const communityIds = searchParams.get("communityIds");
    const wallet = searchParams.get("wallet");

    // Bulk membership check
    if (communityIds && wallet) {
      const ids = communityIds.split(",").filter((id) => id.trim());

      if (ids.length === 0) {
        return NextResponse.json({ membership: {} });
      }

      const { data, error } = await supabaseAdmin
        .from("community_members")
        .select("community_id")
        .eq("user_wallet", wallet)
        .in("community_id", ids);

      if (error) {
        console.error("Failed to check membership:", error);
        return NextResponse.json({ error: "Failed to check membership" }, { status: 500 });
      }

      const membershipMap: Record<string, boolean> = {};
      ids.forEach((id) => {
        membershipMap[id] = (data || []).some((m) => m.community_id === id);
      });

      return NextResponse.json({ membership: membershipMap });
    }

    // Single community members list
    if (communityId) {
      const { data, error } = await supabaseAdmin
        .from("community_members")
        .select("user_wallet")
        .eq("community_id", communityId);

      if (error) {
        console.error("Failed to fetch members:", error);
        return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
      }

      const members = (data || []).map((m) => m.user_wallet);
      return NextResponse.json({ members });
    }

    return NextResponse.json(
      { error: "Either communityId or (communityIds + wallet) is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Community members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
