/**
 * API Route: Friends Management
 *
 * GET /api/friends - Get all friends for the authenticated user
 * POST /api/friends - Add a new friend
 *
 * Requires authentication via JWT token in Authorization header.
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

// GET /api/friends - Get all friends
export async function GET(request: NextRequest) {
  try {
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("friends")
      .select("*")
      .eq("user_wallet", walletAddress)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch friends:", error);
      return NextResponse.json(
        { error: "Failed to fetch friends. Please try again." },
        { status: 500 }
      );
    }

    // Transform to frontend Friend type
    const friends = (data || []).map((f) => ({
      nickname: f.nickname,
      walletAddress: f.wallet_address,
      network: f.network,
      remark: f.remark || "",
    }));

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Get friends error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/friends - Add a new friend
export async function POST(request: NextRequest) {
  try {
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nickname, walletAddress: friendWalletAddress, network, remark } = body;

    // Validate required fields
    if (!nickname || !friendWalletAddress || !network) {
      return NextResponse.json(
        { error: "Nickname, wallet address, and network are required" },
        { status: 400 }
      );
    }

    // Check if friend already exists
    const { data: existing } = await supabaseAdmin
      .from("friends")
      .select("id")
      .eq("user_wallet", walletAddress)
      .eq("wallet_address", friendWalletAddress)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Friend already exists" },
        { status: 400 }
      );
    }

    // Add friend
    const { error } = await supabaseAdmin.from("friends").insert({
      user_wallet: walletAddress,
      nickname: nickname.trim(),
      wallet_address: friendWalletAddress,
      network: network.trim(),
      remark: remark?.trim() || null,
    });

    if (error) {
      console.error("Failed to add friend:", error);
      return NextResponse.json(
        { error: "Failed to add friend. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add friend error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
