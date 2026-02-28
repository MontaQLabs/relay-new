/**
 * API Route: Leave/Quit Community
 *
 * POST /api/community/leave
 * Body: { communityId: string }
 * Requires authentication via JWT token in Authorization header.
 *
 * Response: { success: true } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

async function verifyToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.wallet_address as string) || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { communityId } = body;

    if (!communityId) {
      return NextResponse.json({ error: "Community ID is required" }, { status: 400 });
    }

    // Check if community exists and get owner
    const { data: community, error: communityError } = await supabaseAdmin
      .from("communities")
      .select("community_id, owner_wallet")
      .eq("community_id", communityId)
      .single();

    if (communityError || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    // Check if user is the owner - owners cannot leave their own community
    if (community.owner_wallet.toLowerCase() === walletAddress.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "Community owners cannot leave their own community. You can delete the community instead.",
        },
        { status: 400 }
      );
    }

    // Check if user is a member
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("community_members")
      .select("id")
      .eq("community_id", communityId)
      .eq("user_wallet", walletAddress)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this community" },
        { status: 400 }
      );
    }

    // Leave the community
    const { error: leaveError } = await supabaseAdmin
      .from("community_members")
      .delete()
      .eq("community_id", communityId)
      .eq("user_wallet", walletAddress);

    if (leaveError) {
      console.error("Failed to leave community:", leaveError);
      return NextResponse.json({ error: "Failed to leave community" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave community error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
