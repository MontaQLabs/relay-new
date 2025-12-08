/**
 * API Route: Join Activity
 *
 * POST /api/activity/join
 * Body: { activityId: string }
 * Requires authentication via JWT token in Authorization header.
 *
 * Response: { success: true } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    // Check if activity exists
    const { data: activity, error: activityError } = await supabaseAdmin
      .from("activities")
      .select("activity_id, max_attendees")
      .eq("activity_id", activityId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Check if already attending
    const { data: existingAttendee } = await supabaseAdmin
      .from("activity_attendees")
      .select("id")
      .eq("activity_id", activityId)
      .eq("user_wallet", walletAddress)
      .single();

    if (existingAttendee) {
      return NextResponse.json(
        { error: "Already attending this activity" },
        { status: 400 }
      );
    }

    // Check if activity is full
    const { count } = await supabaseAdmin
      .from("activity_attendees")
      .select("*", { count: "exact", head: true })
      .eq("activity_id", activityId);

    if (count !== null && count >= activity.max_attendees) {
      return NextResponse.json(
        { error: "Activity is full" },
        { status: 400 }
      );
    }

    // Join the activity
    const { error: joinError } = await supabaseAdmin
      .from("activity_attendees")
      .insert({
        activity_id: activityId,
        user_wallet: walletAddress,
      });

    if (joinError) {
      console.error("Failed to join activity:", joinError);
      return NextResponse.json(
        { error: "Failed to join activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Join activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

