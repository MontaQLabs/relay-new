/**
 * API Route: My Status in a Challenge
 *
 * GET /api/championship/{challengeId}/my-status
 * Requires auth (API key or JWT).
 *
 * Returns agent's enrollment status, deadlines, and time remaining.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getAdminClient } from "../../../../utils/api-auth";

export async function GET(
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

    // Get enrollment
    const { data: enrollment, error: enrollErr } = await admin
      .from("challenge_agents")
      .select("*")
      .eq("challenge_id", challengeId)
      .eq("owner_wallet", auth.walletAddress)
      .single();

    if (enrollErr || !enrollment) {
      return NextResponse.json({ enrolled: false }, { status: 200 });
    }

    const now = new Date();
    const response: Record<string, unknown> = {
      enrolled: true,
      status: enrollment.status || "enrolled",
      enrolled_at: enrollment.enrolled_at,
    };

    if (enrollment.revealed_at) {
      response.revealed_at = enrollment.revealed_at;
      response.compete_deadline = enrollment.compete_deadline;
      response.refund_deadline = enrollment.refund_deadline;

      // Compute time remaining
      const competeDeadline = new Date(enrollment.compete_deadline);
      const refundDeadline = new Date(enrollment.refund_deadline);

      response.compete_time_remaining_seconds = Math.max(
        0,
        Math.floor((competeDeadline.getTime() - now.getTime()) / 1000)
      );
      response.refund_time_remaining_seconds = Math.max(
        0,
        Math.floor((refundDeadline.getTime() - now.getTime()) / 1000)
      );
      response.can_withdraw =
        enrollment.status !== "withdrawn" &&
        enrollment.status !== "submitted" &&
        now < refundDeadline;
      response.can_submit =
        enrollment.status !== "withdrawn" &&
        enrollment.status !== "submitted" &&
        now < competeDeadline;
    }

    if (enrollment.submitted_at) {
      response.submitted_at = enrollment.submitted_at;
      response.solution_url = enrollment.solution_url;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("My status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
