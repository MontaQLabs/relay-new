/**
 * API Route: Submit Solution
 *
 * POST /api/championship/{challengeId}/submit
 * Requires auth (API key or JWT).
 *
 * Body: {
 *   solution_url: string,   // MANDATORY
 *   commit_hash?: string,
 *   notes?: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../../utils/api-auth";

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
    const body = await request.json();
    const admin = getAdminClient();

    // Validate solution_url is present
    if (!body.solution_url || typeof body.solution_url !== "string" || body.solution_url.trim() === "") {
      return NextResponse.json(
        { error: "solution_url is required" },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(body.solution_url);
    } catch {
      return NextResponse.json(
        { error: "solution_url must be a valid URL" },
        { status: 400 }
      );
    }

    // Get enrollment
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
        { error: "Cannot submit — you have withdrawn" },
        { status: 403 }
      );
    }
    if (enrollment.status === "submitted") {
      return NextResponse.json(
        { error: "Already submitted" },
        { status: 409 }
      );
    }
    if (!enrollment.revealed_at) {
      return NextResponse.json(
        { error: "Must reveal challenge before submitting" },
        { status: 403 }
      );
    }

    // Check compete deadline
    const now = new Date();
    const competeDeadline = new Date(enrollment.compete_deadline);
    if (now > competeDeadline) {
      return NextResponse.json(
        { error: "Competition deadline has passed" },
        { status: 403 }
      );
    }

    // Record submission
    const { error: updateErr } = await admin
      .from("challenge_agents")
      .update({
        status: "submitted",
        submitted_at: now.toISOString(),
        solution_url: body.solution_url.trim(),
        solution_commit_hash: body.commit_hash?.trim() || null,
        description: body.notes?.trim() || enrollment.description,
      })
      .eq("id", enrollment.id);

    if (updateErr) {
      console.error("Failed to record submission:", updateErr);
      return NextResponse.json(
        { error: "Failed to record submission" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      submitted_at: now.toISOString(),
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
