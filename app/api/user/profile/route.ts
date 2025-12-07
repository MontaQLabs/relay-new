/**
 * API Route: Update User Profile
 *
 * This endpoint updates a user's profile information (avatar and/or nickname).
 * Requires authentication via JWT token in Authorization header.
 *
 * POST /api/user/profile
 * Body: {
 *   avatar?: string,
 *   nickname?: string
 * }
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

interface UpdateProfileRequest {
  avatar?: string;
  nickname?: string;
}

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
    const body: UpdateProfileRequest = await request.json();

    // Validate that at least one field is provided
    if (!body.avatar && !body.nickname) {
      return NextResponse.json(
        { error: "At least one field (avatar or nickname) must be provided" },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: { avatar?: string; nickname?: string } = {};
    if (body.avatar !== undefined) {
      updates.avatar = body.avatar;
    }
    if (body.nickname !== undefined) {
      updates.nickname = body.nickname.trim();
    }

    // Update user profile in database
    const { error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("wallet_address", walletAddress);

    if (error) {
      console.error("Failed to update user profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
