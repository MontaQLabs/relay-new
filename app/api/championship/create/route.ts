/**
 * API Route: Create Challenge (v2)
 *
 * POST /api/championship/create
 * Requires auth (JWT or API key).
 *
 * Body: {
 *   title: string,
 *   categories?: string[],
 *   abstract_description: string,
 *   full_challenge: string,
 *   chain_id?: string,              // default "solana"
 *   entry_fee: string,              // native token amount as string
 *   start_time: string,             // ISO timestamp
 *   end_time: string,               // ISO timestamp
 *   judge_end: string,              // ISO timestamp
 *   competition_duration_seconds: number,
 *   refund_window_seconds: number,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../utils/api-auth";
import { encryptChallenge, hashChallenge } from "../../../utils/championship-crypto";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please authenticate first." },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.title || body.title.trim() === "") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.abstract_description || body.abstract_description.trim() === "") {
      return NextResponse.json(
        { error: "abstract_description is required" },
        { status: 400 }
      );
    }
    if (!body.full_challenge || body.full_challenge.trim() === "") {
      return NextResponse.json(
        { error: "full_challenge is required" },
        { status: 400 }
      );
    }
    if (!body.start_time || !body.end_time || !body.judge_end) {
      return NextResponse.json(
        { error: "start_time, end_time, and judge_end are required" },
        { status: 400 }
      );
    }
    if (!body.entry_fee || BigInt(body.entry_fee) <= BigInt(0)) {
      return NextResponse.json(
        { error: "entry_fee must be positive" },
        { status: 400 }
      );
    }
    if (
      !body.competition_duration_seconds ||
      body.competition_duration_seconds <= 0
    ) {
      return NextResponse.json(
        { error: "competition_duration_seconds must be positive" },
        { status: 400 }
      );
    }
    if (!body.refund_window_seconds || body.refund_window_seconds <= 0) {
      return NextResponse.json(
        { error: "refund_window_seconds must be positive" },
        { status: 400 }
      );
    }

    // Validate timestamp order
    const startTime = new Date(body.start_time);
    const endTime = new Date(body.end_time);
    const judgeEnd = new Date(body.judge_end);
    const now = new Date();

    if (startTime <= now) {
      return NextResponse.json(
        { error: "start_time must be in the future" },
        { status: 400 }
      );
    }
    if (endTime <= startTime) {
      return NextResponse.json(
        { error: "end_time must be after start_time" },
        { status: 400 }
      );
    }
    if (judgeEnd <= endTime) {
      return NextResponse.json(
        { error: "judge_end must be after end_time" },
        { status: 400 }
      );
    }

    const chainId = body.chain_id || "solana";

    // Encrypt full challenge and compute hash
    const fullChallengeEncrypted = encryptChallenge(body.full_challenge);
    const challengeHash = hashChallenge(body.full_challenge);

    const challengeId = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const admin = getAdminClient();

    const { error: insertError } = await admin.from("challenges").insert({
      challenge_id: challengeId,
      creator_wallet: auth.walletAddress,
      title: body.title.trim(),
      description: body.abstract_description.trim(), // backward compat
      abstract_description: body.abstract_description.trim(),
      full_challenge_encrypted: fullChallengeEncrypted,
      challenge_hash: challengeHash,
      categories: body.categories || null,
      chain_id: chainId,
      rules: null,
      start_time: body.start_time,
      end_time: body.end_time,
      judge_end: body.judge_end,
      entry_fee_dot: body.entry_fee,
      competition_duration_seconds: body.competition_duration_seconds,
      refund_window_seconds: body.refund_window_seconds,
      status: "enrolling",
    });

    if (insertError) {
      console.error("Failed to create challenge:", insertError);
      return NextResponse.json(
        { error: "Failed to create challenge" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      challenge_id: challengeId,
      challenge_hash: challengeHash,
      chain_id: chainId,
    });
  } catch (error) {
    console.error("Create challenge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
