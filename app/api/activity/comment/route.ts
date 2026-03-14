/**
 * API Route: Create Activity Comment
 *
 * POST /api/activity/comment
 * Body: { activityId: string, content: string }
 * Requires authentication via JWT token in Authorization header.
 *
 * Response: { commentId: string } | { error: string }
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
    const { activityId, content } = body;

    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    // Check if activity exists
    const { data: activity, error: activityError } = await supabaseAdmin
      .from("activities")
      .select("activity_id")
      .eq("activity_id", activityId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Generate comment ID
    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create the comment
    const { error: insertError } = await supabaseAdmin.from("comments").insert({
      comment_id: commentId,
      activity_id: activityId,
      publisher_wallet: walletAddress,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      likes: 0,
    });

    if (insertError) {
      console.error("Failed to create comment:", insertError);
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    return NextResponse.json({ commentId });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
