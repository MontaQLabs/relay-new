/**
 * API Route: Generate Authentication Nonce
 *
 * This endpoint generates a one-time nonce for wallet authentication.
 * The nonce is stored in Supabase and must be used within 5 minutes.
 *
 * POST /api/auth/nonce
 * Body: { walletAddress: string }
 * Response: { message: string, nonce: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";
import { generateNonce, createAuthMessage, isValidWalletAddress } from "@/app/utils/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    // Validate wallet address
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 });
    }

    if (!isValidWalletAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
    }

    // Generate a unique nonce
    const nonce = generateNonce();

    // Calculate expiration time (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Delete any existing nonces for this wallet (cleanup)
    await supabaseAdmin.from("auth_nonces").delete().eq("wallet_address", walletAddress);

    // Create the message that the user will sign
    // IMPORTANT: Create this BEFORE storing, so we can store the exact message
    const message = createAuthMessage(nonce, walletAddress);

    // Store the nonce AND the message in the database
    const { error } = await supabaseAdmin.from("auth_nonces").insert({
      wallet_address: walletAddress,
      nonce: nonce,
      message: message, // Store the exact message for verification
      expires_at: expiresAt,
    });

    if (error) {
      console.error("Failed to store nonce:", error);
      return NextResponse.json(
        { error: "Failed to generate authentication nonce" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message,
      nonce,
    });
  } catch (error) {
    console.error("Nonce generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
