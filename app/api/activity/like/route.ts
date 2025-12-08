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
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    // Increment likes using RPC function
    const { error } = await supabaseAdmin.rpc("increment_activity_likes", {
      p_activity_id: activityId,
    });

    if (error) {
      console.error("Failed to like activity:", error);
      return NextResponse.json(
        { error: "Failed to like activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Like activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

