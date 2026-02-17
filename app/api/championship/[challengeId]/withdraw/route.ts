/**
 * API Route: Withdraw from Challenge (98% refund)
 *
 * POST /api/championship/{challengeId}/withdraw
 * Requires auth (API key or JWT).
 *
 * Must have revealed and be within refund window.
 *
 * Response: { refund_amount, peek_fee, tx_signature }
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

    // Validate conditions
    if (enrollment.status === "withdrawn") {
      return NextResponse.json(
        { error: "Already withdrawn" },
        { status: 409 }
      );
    }
    if (enrollment.status === "submitted") {
      return NextResponse.json(
        { error: "Cannot withdraw after submitting" },
        { status: 403 }
      );
    }
    if (!enrollment.revealed_at) {
      return NextResponse.json(
        { error: "Must reveal before withdrawing" },
        { status: 403 }
      );
    }

    const now = new Date();
    const refundDeadline = new Date(enrollment.refund_deadline);
    if (now > refundDeadline) {
      return NextResponse.json(
        { error: "Refund window has expired" },
        { status: 403 }
      );
    }

    // Calculate refund amounts
    const entryFee = BigInt(challenge.entry_fee_dot);
    const refundAmount = (entryFee * BigInt(98)) / BigInt(100);
    const peekFee = (entryFee * BigInt(2)) / BigInt(100);

    // TODO: Execute on-chain withdraw via escrow adapter
    // const escrow = getEscrowAdapter(challenge.chain_id);
    // const tx = await escrow.withdraw(...);

    // Update status in DB
    const { error: updateErr } = await admin
      .from("challenge_agents")
      .update({ status: "withdrawn" })
      .eq("id", enrollment.id);

    if (updateErr) {
      console.error("Failed to update withdrawal:", updateErr);
      return NextResponse.json(
        { error: "Failed to record withdrawal" },
        { status: 500 }
      );
    }

    // Record payout entries for audit
    await admin.from("challenge_payouts").insert([
      {
        challenge_id: challengeId,
        recipient_wallet: auth.walletAddress,
        amount_dot: refundAmount.toString(),
        payout_type: "withdrawal_refund",
        status: "pending",
      },
      {
        challenge_id: challengeId,
        recipient_wallet: process.env.PLATFORM_WALLET_ADDRESS || "platform",
        amount_dot: peekFee.toString(),
        payout_type: "withdrawal_peek_fee",
        status: "pending",
      },
    ]);

    return NextResponse.json({
      refund_amount: refundAmount.toString(),
      peek_fee: peekFee.toString(),
      tx_signature: `withdraw_${Date.now()}`, // placeholder until on-chain wiring
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
