/**
 * API Route: Activity Comments
 *
 * GET /api/activity/comments?activityId=xxx
 * Returns all comments for an activity
 *
 * Response: { comments: Comment[] } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";

interface DbComment {
  comment_id: string;
  activity_id: string;
  publisher_wallet: string;
  content: string;
  timestamp: string;
  likes: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("comments")
      .select("*")
      .eq("activity_id", activityId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Failed to fetch comments:", error);
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    const comments = (data || []).map((c: DbComment) => ({
      commentId: c.comment_id,
      publisher: c.publisher_wallet,
      content: c.content,
      timestamp: c.timestamp,
      likes: c.likes,
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
