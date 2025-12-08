/**
 * API Route: Get User Nicknames
 *
 * POST /api/user/nicknames
 * Body: { walletAddresses: string[] }
 *
 * Response: { nicknames: Record<string, string> } | { error: string }
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
    const { walletAddresses } = body;

    if (!walletAddresses || !Array.isArray(walletAddresses)) {
      return NextResponse.json(
        { error: "Wallet addresses array is required" },
        { status: 400 }
      );
    }

    if (walletAddresses.length === 0) {
      return NextResponse.json({ nicknames: {} });
    }

    // Remove duplicates
    const uniqueAddresses = [...new Set(walletAddresses)] as string[];

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("wallet_address, nickname")
      .in("wallet_address", uniqueAddresses);

    const nicknameMap: Record<string, string> = {};

    // Initialize all addresses with truncated fallback
    uniqueAddresses.forEach((address) => {
      nicknameMap[address] = `${address.slice(0, 6)}...${address.slice(-4)}`;
    });

    // Override with actual nicknames where available
    if (!error && data) {
      data.forEach((user: { wallet_address: string; nickname: string | null }) => {
        if (user.nickname) {
          nicknameMap[user.wallet_address] = user.nickname;
        }
      });
    }

    return NextResponse.json({ nicknames: nicknameMap });
  } catch (error) {
    console.error("Get nicknames error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

