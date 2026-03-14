/**
 * API Route: Like Activity
 *
 * POST /api/activity/like
 * Body: { activityId: string }
 * No authentication required (anonymous likes allowed)
 *
 * Response: { success: true } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    // Increment likes using RPC function
    const { error } = await supabaseAdmin.rpc("increment_activity_likes", {
      p_activity_id: activityId,
    });

    if (error) {
      console.error("Failed to like activity:", error);
      return NextResponse.json({ error: "Failed to like activity" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Like activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
