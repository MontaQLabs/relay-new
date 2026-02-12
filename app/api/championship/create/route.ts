/**
 * API Route: Create Challenge
 *
 * POST /api/championship/create
 * Requires JWT authentication.
 *
 * Body: {
 *   title: string,
 *   description: string,
 *   rules?: string,
 *   enrollEnd: string,     // ISO timestamp
 *   competeEnd: string,    // ISO timestamp
 *   judgeEnd: string,      // ISO timestamp
 *   entryFeeDot: string,   // DOT amount as string
 * }
 *
 * Response: { success: true, challengeId: string } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

interface CreateChallengeRequest {
  title: string;
  description: string;
  rules?: string;
  enrollEnd: string;
  competeEnd: string;
  judgeEnd: string;
  entryFeeDot: string;
}

export async function POST(request: NextRequest) {
  try {
    const walletAddress = await verifyToken(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const body: CreateChallengeRequest = await request.json();

    // Validate required fields
    if (!body.title || body.title.trim() === "") {
      return NextResponse.json(
        { error: "Challenge title is required" },
        { status: 400 }
      );
    }

    if (!body.description || body.description.trim() === "") {
      return NextResponse.json(
        { error: "Challenge description is required" },
        { status: 400 }
      );
    }

    if (!body.enrollEnd || !body.competeEnd || !body.judgeEnd) {
      return NextResponse.json(
        { error: "All phase deadlines are required" },
        { status: 400 }
      );
    }

    // Validate phase order
    const enrollEnd = new Date(body.enrollEnd);
    const competeEnd = new Date(body.competeEnd);
    const judgeEnd = new Date(body.judgeEnd);
    const now = new Date();

    if (enrollEnd <= now) {
      return NextResponse.json(
        { error: "Enrollment deadline must be in the future" },
        { status: 400 }
      );
    }

    if (competeEnd <= enrollEnd) {
      return NextResponse.json(
        { error: "Compete deadline must be after enrollment deadline" },
        { status: 400 }
      );
    }

    if (judgeEnd <= competeEnd) {
      return NextResponse.json(
        { error: "Judge deadline must be after compete deadline" },
        { status: 400 }
      );
    }

    // Validate entry fee
    if (!body.entryFeeDot || BigInt(body.entryFeeDot) <= BigInt(0)) {
      return NextResponse.json(
        { error: "Entry fee must be a positive DOT amount" },
        { status: 400 }
      );
    }

    // Generate challenge ID
    const challengeId = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create challenge
    const { error: challengeError } = await supabaseAdmin
      .from("challenges")
      .insert({
        challenge_id: challengeId,
        creator_wallet: walletAddress,
        title: body.title.trim(),
        description: body.description.trim(),
        rules: body.rules?.trim() || null,
        enroll_end: body.enrollEnd,
        compete_end: body.competeEnd,
        judge_end: body.judgeEnd,
        entry_fee_dot: body.entryFeeDot,
        status: "enrolling",
        // escrow_address will be set when escrow wallet is generated
      });

    if (challengeError) {
      console.error("Failed to create challenge:", challengeError);
      return NextResponse.json(
        { error: "Failed to create challenge. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      challengeId,
    });
  } catch (error) {
    console.error("Create challenge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
