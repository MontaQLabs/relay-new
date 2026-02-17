/**
 * Unified API Authentication — supports both JWT tokens and API keys.
 *
 * Usage in API routes:
 *   const auth = await authenticateRequest(request);
 *   if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   // auth.walletAddress, auth.accountType, auth.agentId (if agent)
 */

import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import type { ChainId } from "../chains/types";

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthContext {
  walletAddress: string;
  accountType: "human" | "agent";
  agentId?: string;
  /** All chain accounts for this user (useful for multi-chain operations). */
  chainAccounts?: { chainId: ChainId; address: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Verify a JWT token and extract the wallet address.
 */
async function verifyJwt(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.wallet_address as string) || null;
  } catch {
    return null;
  }
}

/**
 * Verify an API key (prefixed `rly_ak_`) against the agents table.
 * Returns the agent record if valid.
 */
async function verifyApiKey(
  apiKey: string
): Promise<{
  walletAddress: string;
  agentId: string;
  chainAccounts: { chainId: ChainId; address: string }[];
} | null> {
  if (!apiKey.startsWith("rly_ak_")) return null;

  const keyHash = sha256Hex(apiKey);

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("id, wallet_address, is_active")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent || !agent.is_active) return null;

  // Fetch chain accounts for the agent
  const { data: accounts } = await supabaseAdmin
    .from("chain_accounts")
    .select("chain_id, chain_address")
    .eq("user_wallet", agent.wallet_address);

  const chainAccounts = (accounts || []).map((a: { chain_id: string; chain_address: string }) => ({
    chainId: a.chain_id as ChainId,
    address: a.chain_address,
  }));

  return {
    walletAddress: agent.wallet_address,
    agentId: agent.id,
    chainAccounts,
  };
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Authenticate an incoming API request.
 * Supports:
 *   - `Authorization: Bearer <jwt>` (human users)
 *   - `Authorization: Bearer rly_ak_...` (agent API keys)
 *
 * Returns AuthContext on success, or null if unauthenticated.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);

  // Try API key first (fast prefix check)
  if (token.startsWith("rly_ak_")) {
    const result = await verifyApiKey(token);
    if (!result) return null;
    return {
      walletAddress: result.walletAddress,
      accountType: "agent",
      agentId: result.agentId,
      chainAccounts: result.chainAccounts,
    };
  }

  // Try JWT
  const walletAddress = await verifyJwt(token);
  if (!walletAddress) return null;

  // Check account type
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("account_type")
    .eq("wallet_address", walletAddress)
    .single();

  return {
    walletAddress,
    accountType: (user?.account_type as "human" | "agent") || "human",
  };
}

/**
 * Get the Supabase admin client (service role — bypasses RLS).
 * Use only in API routes for server-side operations.
 */
export function getAdminClient() {
  return supabaseAdmin;
}
