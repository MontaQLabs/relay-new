/**
 * API Route: Create Community
 *
 * This endpoint creates a new community and optionally its token.
 * Requires authentication via JWT token in Authorization header.
 *
 * POST /api/community/create
 * Body: {
 *   name: string,
 *   description: string,
 *   rules?: string,
 *   activityTypes: string[],
 *   allowInvestment: boolean,
 *   avatar?: string,
 *   token?: {
 *     name: string,
 *     symbol: string,
 *     decimals: number,
 *     minBalance: string,
 *     initialSupply: string,
 *     issuer?: string,
 *     freezer?: string,
 *     icon?: string,
 *     configLocked?: boolean,
 *   }
 * }
 * Response: { success: true, communityId: string } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase-admin";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

interface CreateCommunityRequest {
  name: string;
  description: string;
  rules?: string;
  activityTypes: string[];
  allowInvestment: boolean;
  avatar?: string;
  token?: {
    name: string;
    symbol: string;
    decimals: number;
    minBalance: string;
    initialSupply: string;
    issuer?: string;
    freezer?: string;
    icon?: string;
    configLocked?: boolean;
  };
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
    const body: CreateCommunityRequest = await request.json();

    // Validate required fields
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "Community name is required" }, { status: 400 });
    }

    if (!body.description || body.description.trim() === "") {
      return NextResponse.json({ error: "Community description is required" }, { status: 400 });
    }

    if (!body.activityTypes || body.activityTypes.length === 0) {
      return NextResponse.json(
        { error: "At least one activity type is required" },
        { status: 400 }
      );
    }

    // Validate token fields if token is provided
    if (body.token) {
      if (!body.token.name || body.token.name.trim() === "") {
        return NextResponse.json({ error: "Token name is required" }, { status: 400 });
      }

      if (!body.token.symbol || !/^[A-Z]{3,5}$/.test(body.token.symbol.toUpperCase())) {
        return NextResponse.json(
          { error: "Token symbol must be 3-5 uppercase letters" },
          { status: 400 }
        );
      }

      if (
        body.token.decimals === undefined ||
        body.token.decimals < 0 ||
        body.token.decimals > 18
      ) {
        return NextResponse.json(
          { error: "Token decimals must be between 0 and 18" },
          { status: 400 }
        );
      }

      if (!body.token.minBalance) {
        return NextResponse.json({ error: "Token minimum balance is required" }, { status: 400 });
      }

      if (!body.token.initialSupply) {
        return NextResponse.json({ error: "Token initial supply is required" }, { status: 400 });
      }
    }

    // Generate community ID
    const communityId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create community in database
    const { error: communityError } = await supabaseAdmin.from("communities").insert({
      community_id: communityId,
      owner_wallet: walletAddress,
      name: body.name.trim(),
      avatar: body.avatar || null,
      description: body.description.trim(),
      rules: body.rules?.trim() || null,
      activity_types: body.activityTypes,
      allow_investment: body.allowInvestment,
    });

    if (communityError) {
      console.error("Failed to create community:", communityError);
      return NextResponse.json(
        { error: "Failed to create community. Please try again." },
        { status: 500 }
      );
    }

    // Add owner as a member
    const { error: memberError } = await supabaseAdmin.from("community_members").insert({
      community_id: communityId,
      user_wallet: walletAddress,
    });

    if (memberError) {
      console.error("Failed to add owner as member:", memberError);
      // Continue anyway - not critical
    }

    // Create community token if provided
    if (body.token) {
      // Generate a unique asset ID (in production, this should be coordinated with the chain)
      const assetId = Math.floor(Date.now() % 1000000000);

      const { error: tokenError } = await supabaseAdmin.from("community_tokens").insert({
        community_id: communityId,
        asset_id: assetId,
        admin_wallet: walletAddress,
        min_balance: body.token.minBalance,
        name: body.token.name.trim(),
        symbol: body.token.symbol.toUpperCase(),
        decimals: body.token.decimals,
        initial_supply: body.token.initialSupply,
        issuer_wallet: body.token.issuer?.trim() || null,
        freezer_wallet: body.token.freezer?.trim() || null,
        is_frozen: false,
        total_supply: body.token.initialSupply,
        icon: body.token.icon?.trim() || null,
      });

      if (tokenError) {
        console.error("Failed to create community token:", tokenError);
        // Don't fail the whole operation, community was created successfully
        return NextResponse.json({
          success: true,
          communityId,
          warning: "Community created but token creation failed.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      communityId,
    });
  } catch (error) {
    console.error("Create community error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
