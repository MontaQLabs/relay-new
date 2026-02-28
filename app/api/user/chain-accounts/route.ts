/**
 * API Route: Manage Chain Accounts
 *
 * POST /api/user/chain-accounts
 *   Upserts chain accounts for the authenticated user.
 *   Body: { accounts: Array<{ chainId: string; address: string }> }
 *
 * GET /api/user/chain-accounts
 *   Returns all chain accounts for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

async function verifyToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.wallet_address as string) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET – list chain accounts
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const walletAddress = await verifyToken(request);
  if (!walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("chain_accounts")
    .select("chain_id, chain_address, created_at")
    .eq("user_wallet", walletAddress)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data });
}

// ---------------------------------------------------------------------------
// POST – upsert chain accounts
// ---------------------------------------------------------------------------

interface ChainAccountInput {
  chainId: string;
  address: string;
}

export async function POST(request: NextRequest) {
  const walletAddress = await verifyToken(request);
  if (!walletAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const accounts: ChainAccountInput[] = body.accounts;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return NextResponse.json({ error: "accounts array is required" }, { status: 400 });
  }

  // Validate input
  for (const acct of accounts) {
    if (!acct.chainId || !acct.address) {
      return NextResponse.json(
        { error: "Each account must have chainId and address" },
        { status: 400 }
      );
    }
  }

  // Upsert each chain account
  const rows = accounts.map((acct) => ({
    user_wallet: walletAddress,
    chain_id: acct.chainId,
    chain_address: acct.address,
  }));

  const { error } = await supabaseAdmin.from("chain_accounts").upsert(rows, {
    onConflict: "user_wallet,chain_id",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
