/**
 * POST /api/poker/claim
 * Body: { tableId, claimType: "chips" | "prize" | "bet" | "refund", mnemonic }
 */
import { NextRequest, NextResponse } from "next/server";
import { claimChips, claimPrize, claimBetWinnings, refund } from "@/app/services/poker";

export async function POST(request: NextRequest) {
  try {
    const { tableId, claimType, mnemonic } = await request.json();

    if (!tableId || !claimType || !mnemonic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tid = Number(tableId);
    let result;

    switch (claimType) {
      case "chips":
        result = await claimChips(mnemonic, tid);
        break;
      case "prize":
        result = await claimPrize(mnemonic, tid);
        break;
      case "bet":
        result = await claimBetWinnings(mnemonic, tid);
        break;
      case "refund":
        result = await refund(mnemonic, tid);
        break;
      default:
        return NextResponse.json({ error: "Invalid claimType" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, txHash: result.hash });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transaction failed" },
      { status: 500 }
    );
  }
}
