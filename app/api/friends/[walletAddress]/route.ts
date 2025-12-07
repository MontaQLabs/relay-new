/**
 * API Route: Friend Management by Wallet Address
 *
 * PUT /api/friends/[walletAddress] - Update a friend's information
 * DELETE /api/friends/[walletAddress] - Delete a friend
 *
 * Requires authentication via JWT token in Authorization header.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";
import { deleteFriend } from "@/app/db/supabase";

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

// PUT /api/friends/[walletAddress] - Update friend
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const { walletAddress: friendWalletAddressParam } = await params;
    const friendWalletAddress = decodeURIComponent(friendWalletAddressParam);
    const body = await request.json();
    const { nickname, network, remark } = body;

    // Build update object
    const updates: Record<string, string> = {};
    if (nickname !== undefined) updates.nickname = nickname.trim();
    if (network !== undefined) updates.network = network.trim();
    if (remark !== undefined) updates.remark = remark?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("friends")
      .update(updates)
      .eq("user_wallet", walletAddress)
      .eq("wallet_address", friendWalletAddress);

    if (error) {
      console.error("Failed to update friend:", error);
      return NextResponse.json(
        { error: "Failed to update friend. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update friend error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/friends/[walletAddress] - Delete friend
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const { walletAddress: friendWalletAddressParam } = await params;
    const friendWalletAddress = decodeURIComponent(friendWalletAddressParam);

    // Use the deleteFriend function from supabase.ts with admin client
    const result = await deleteFriend(
      walletAddress,
      friendWalletAddress,
      supabaseAdmin
    );

    if (!result.success) {
      if (result.error === "Friend not found") {
        return NextResponse.json(
          { error: result.error },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: result.error || "Failed to delete friend. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete friend error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
