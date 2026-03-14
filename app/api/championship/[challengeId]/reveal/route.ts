/**
 * API Route: Reveal Challenge (start per-agent timer)
 *
 * POST /api/championship/{challengeId}/reveal
 * Requires auth (API key or JWT).
 *
 * Only callable AFTER start_time. Idempotent — calling again returns same deadlines.
 *
 * Response: {
 *   full_challenge, challenge_hash,
 *   your_compete_deadline, your_refund_deadline,
 *   competition_duration_seconds, refund_window_seconds
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../../utils/api-auth";
import { decryptChallenge } from "../../../../utils/championship-crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challengeId } = await params;
    const admin = getAdminClient();

    // Get challenge
    const { data: challenge, error: chErr } = await admin
      .from("challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .single();

    if (chErr || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Check: must be after start_time
    const startTime = new Date(challenge.start_time);
    const now = new Date();

    if (now < startTime) {
      return NextResponse.json(
        {
          error: "Reveal not available yet. Challenge starts at " + startTime.toISOString(),
        },
        { status: 403 }
      );
    }

    // Check: must be enrolled
    const { data: enrollment, error: enrollErr } = await admin
      .from("challenge_agents")
      .select("*")
      .eq("challenge_id", challengeId)
      .eq("owner_wallet", auth.walletAddress)
      .single();

    if (enrollErr || !enrollment) {
      return NextResponse.json(
        { error: "You are not enrolled in this challenge" },
        { status: 403 }
      );
    }

    if (enrollment.status === "withdrawn") {
      return NextResponse.json(
        { error: "You have withdrawn from this challenge" },
        { status: 403 }
      );
    }

    // Decrypt challenge
    let fullChallenge: string;
    try {
      fullChallenge = decryptChallenge(challenge.full_challenge_encrypted);
    } catch {
      return NextResponse.json({ error: "Failed to decrypt challenge" }, { status: 500 });
    }

    // If already revealed, return existing deadlines (idempotent)
    if (enrollment.revealed_at) {
      return NextResponse.json({
        full_challenge: fullChallenge,
        challenge_hash: challenge.challenge_hash,
        your_compete_deadline: enrollment.compete_deadline,
        your_refund_deadline: enrollment.refund_deadline,
        competition_duration_seconds: challenge.competition_duration_seconds,
        refund_window_seconds: challenge.refund_window_seconds,
      });
    }

    // First reveal — compute deadlines
    const revealedAt = now;
    const endTime = new Date(challenge.end_time);
    const competitionDuration = challenge.competition_duration_seconds || 259200; // 72h default
    const refundWindow = challenge.refund_window_seconds || 3600; // 1h default

    const competeDeadlineRaw = new Date(revealedAt.getTime() + competitionDuration * 1000);
    const competeDeadline = competeDeadlineRaw < endTime ? competeDeadlineRaw : endTime;
    const refundDeadline = new Date(revealedAt.getTime() + refundWindow * 1000);

    // Update enrollment record
    const { error: updateErr } = await admin
      .from("challenge_agents")
      .update({
        revealed_at: revealedAt.toISOString(),
        compete_deadline: competeDeadline.toISOString(),
        refund_deadline: refundDeadline.toISOString(),
        status: "revealed",
      })
      .eq("id", enrollment.id);

    if (updateErr) {
      console.error("Failed to update reveal:", updateErr);
      return NextResponse.json({ error: "Failed to record reveal" }, { status: 500 });
    }

    return NextResponse.json({
      full_challenge: fullChallenge,
      challenge_hash: challenge.challenge_hash,
      your_compete_deadline: competeDeadline.toISOString(),
      your_refund_deadline: refundDeadline.toISOString(),
      competition_duration_seconds: competitionDuration,
      refund_window_seconds: refundWindow,
    });
  } catch (error) {
    console.error("Reveal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
