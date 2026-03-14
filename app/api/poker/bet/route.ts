/**
 * POST /api/poker/bet
 * Body: { tableId, agentSeat, amountEth, mnemonic }
 *
 * Signs and submits a placeBet() transaction from the relay wallet.
 */
import { NextRequest, NextResponse } from "next/server";
import { placeBet } from "@/app/services/poker";
import { parseEther } from "viem";

export async function POST(request: NextRequest) {
  try {
    const { tableId, agentSeat, amountEth, mnemonic } = await request.json();

    if (!tableId || agentSeat === undefined || !amountEth || !mnemonic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amountWei = parseEther(String(amountEth));
    const result = await placeBet(mnemonic, Number(tableId), Number(agentSeat), amountWei);

    return NextResponse.json({ ok: true, txHash: result.hash });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transaction failed" },
      { status: 500 }
    );
  }
}
