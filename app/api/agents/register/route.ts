/**
 * API Route: Register Agent
 *
 * POST /api/agents/register
 * No auth required — agents self-register.
 *
 * Body: {
 *   agent_name: string       (required)
 *   description?: string
 *   repo_url?: string
 *   endpoint_url?: string
 *   capabilities?: string[]
 * }
 *
 * Response: {
 *   agent_id, wallet_address, chain_accounts,
 *   mnemonic, api_key, claim_token
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";
import { mnemonicGenerate, cryptoWaitReady } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";
import { generateToken, sha256 } from "../../../utils/championship-crypto";
import { initChainRegistry } from "../../../chains/registry";

const SS58_FORMAT = 42; // Generic Substrate

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.agent_name || typeof body.agent_name !== "string" || body.agent_name.trim() === "") {
      return NextResponse.json({ error: "agent_name is required" }, { status: 400 });
    }

    const agentName = body.agent_name.trim();

    // Check for duplicate agent name
    const { data: existing } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("agent_name", agentName)
      .single();

    if (existing) {
      return NextResponse.json({ error: "agent_name already taken" }, { status: 409 });
    }

    // 1. Generate mnemonic
    await cryptoWaitReady();
    const mnemonic = mnemonicGenerate(12);

    // 2. Derive primary (Polkadot) address
    const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
    const pair = keyring.addFromMnemonic(mnemonic);
    const walletAddress = pair.address;

    // 3. Derive all chain accounts
    let chainAccounts: { chainId: string; address: string }[];
    try {
      const registry = await initChainRegistry("testnet");
      const derived = await registry.deriveAllAddresses(mnemonic);
      chainAccounts = derived.map((a) => ({
        chainId: a.chainId,
        address: a.address,
      }));
    } catch {
      // Fallback to Polkadot only
      chainAccounts = [{ chainId: "polkadot", address: walletAddress }];
    }

    // 4. Generate API key and claim token
    const apiKey = generateToken("rly_ak_");
    const claimToken = generateToken("rly_ct_");
    const apiKeyHash = sha256(apiKey);
    const claimTokenHash = sha256(claimToken);

    // 5. Create user row (account_type = 'agent')
    const { error: userError } = await supabaseAdmin.from("users").insert({
      wallet_address: walletAddress,
      nickname: agentName,
      account_type: "agent",
    });

    if (userError) {
      console.error("Failed to create user for agent:", userError);
      return NextResponse.json({ error: "Failed to create agent account" }, { status: 500 });
    }

    // 6. Create chain_accounts rows
    for (const account of chainAccounts) {
      await supabaseAdmin.from("chain_accounts").insert({
        user_wallet: walletAddress,
        chain_id: account.chainId,
        chain_address: account.address,
      });
    }

    // 7. Create agent row
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("agents")
      .insert({
        wallet_address: walletAddress,
        agent_name: agentName,
        description: body.description?.trim() || null,
        repo_url: body.repo_url?.trim() || null,
        endpoint_url: body.endpoint_url?.trim() || null,
        capabilities: body.capabilities || null,
        api_key_hash: apiKeyHash,
        claim_token_hash: claimTokenHash,
      })
      .select("id")
      .single();

    if (agentError || !agent) {
      console.error("Failed to create agent:", agentError);
      return NextResponse.json({ error: "Failed to create agent profile" }, { status: 500 });
    }

    return NextResponse.json({
      agent_id: agent.id,
      wallet_address: walletAddress,
      chain_accounts: chainAccounts,
      mnemonic,
      api_key: apiKey,
      claim_token: claimToken,
    });
  } catch (error) {
    console.error("Agent registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
