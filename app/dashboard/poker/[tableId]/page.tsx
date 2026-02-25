"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Trophy, Zap, Clock, Users, Coins, RefreshCw,
} from "lucide-react";
import { usePokerTable, usePlaceBet, useClaim } from "@/hooks/usePoker";
import { useAuth } from "@/hooks";
import { formatEther } from "viem";
import { TABLE_STATE, TABLE_STATE_LABEL } from "@/app/services/poker/contract";
import { getMnemonic } from "@/app/utils/wallet"; // existing relay util

const STATE_COLORS: Record<number, string> = {
    0: "text-emerald-600",
    1: "text-violet-600",
    2: "text-gray-400",
    3: "text-red-400",
};

export default function PokerTablePage() {
    const router = useRouter();
    const params = useParams();
    const tableId = Number(params.tableId);

    const { walletAddress } = useAuth();
    const { table, isLoading, error, refetch } = usePokerTable(tableId);
    const { bet, isLoading: betLoading, error: betError } = usePlaceBet();
    const { claim, isLoading: claimLoading, error: claimError } = useClaim();

    const [betSeat, setBetSeat] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState("0.01");
    const [txMsg, setTxMsg] = useState<string | null>(null);

    const mnemonic = getMnemonic(); // reads from relay's secure session storage

    async function handleBet() {
        if (betSeat === null || !mnemonic) return;
        try {
            const result = await bet({ tableId, agentSeat: betSeat, amountEth: betAmount, mnemonic });
            setTxMsg(`✅ Bet placed! TX: ${result.txHash.slice(0, 18)}...`);
            refetch();
        } catch { /* error shown via betError state */ }
    }

    async function handleClaim(type: "chips" | "prize" | "bet" | "refund") {
        if (!mnemonic) return;
        try {
            const result = await claim({ tableId, claimType: type, mnemonic });
            setTxMsg(`✅ Claimed! TX: ${result.txHash.slice(0, 18)}...`);
            refetch();
        } catch { /* error shown via claimError state */ }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !table) {
        return (
            <div className="px-5 py-10 text-center">
                <p className="text-gray-400">{error || "Table not found"}</p>
                <button onClick={() => router.back()} className="mt-4 text-violet-500 text-sm">← Go back</button>
            </div>
        );
    }

    const isOpen = table.state === TABLE_STATE.OPEN;
    const isPlaying = table.state === TABLE_STATE.PLAYING;
    const isEnded = table.state === TABLE_STATE.ENDED;
    const isCancelled = table.state === TABLE_STATE.CANCELLED;
    const deadline = new Date(Number(table.betDeadline) * 1000);
    const betWindowOpen = isOpen && Date.now() < Number(table.betDeadline) * 1000;

    return (
        <div className="flex flex-col pb-10">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="font-bold text-black">Table #{tableId}</h1>
                    <span className={`text-xs font-medium ${STATE_COLORS[table.state]}`}>
                        {table.stateLabel}
                        {isPlaying && ` · Hand ${table.currentHand}/${table.sessionLength}`}
                    </span>
                </div>
                <button onClick={refetch} className="ml-auto text-gray-400 hover:text-violet-500 transition-colors">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 px-5 mb-4">
                {[
                    { icon: Coins, label: "Prize Pool", value: `${table.prizePoolEth} PAS` },
                    { icon: Users, label: "Agents", value: `${table.agentCount}/${table.maxAgents}` },
                    { icon: Zap, label: "Buy-in", value: `${table.buyInEth} PAS` },
                ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-2xl px-3 py-3 text-center">
                        <Icon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                        <div className="text-xs text-gray-400">{label}</div>
                        <div className="text-sm font-semibold text-black mt-0.5">{value}</div>
                    </div>
                ))}
            </div>

            {/* Bet pool (when open) */}
            {(isOpen || isPlaying) && (
                <div className="px-5 mb-4">
                    <div className="bg-violet-50 rounded-2xl px-4 py-3 flex justify-between items-center">
                        <span className="text-sm text-violet-600 font-medium">Human Bet Pool</span>
                        <span className="text-sm font-bold text-violet-700">
                            {formatEther(BigInt(table.betPoolEth || "0"))} PAS
                        </span>
                    </div>
                </div>
            )}

            {/* Bet deadline */}
            {isOpen && (
                <div className="px-5 mb-4">
                    <div className="flex items-center gap-2 bg-amber-50 rounded-2xl px-4 py-2.5">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-amber-700">
                            {betWindowOpen
                                ? `Bets close ${deadline.toLocaleString()}`
                                : "Betting window closed — waiting for dealer"}
                        </span>
                    </div>
                </div>
            )}

            {/* TX message */}
            {txMsg && (
                <div className="mx-5 mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-xs text-emerald-700">{txMsg}</p>
                </div>
            )}

            {/* Agent seats */}
            <div className="px-5 mb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Agents</h2>
                {table.agents && table.agents.length > 0 ? (
                    <div className="space-y-2">
                        {table.agents.map(agent => (
                            <div
                                key={agent.seat}
                                className={`flex items-center gap-3 p-3 rounded-2xl border ${betSeat === agent.seat ? "border-violet-400 bg-violet-50" : "border-gray-100"
                                    } ${agent.kicked ? "opacity-40" : ""}`}
                            >
                                {/* Seat badge */}
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${agent.kicked ? "bg-red-100 text-red-400" :
                                        agent.folded ? "bg-gray-100 text-gray-400" :
                                            "bg-violet-100 text-violet-600"
                                    }`}>
                                    {agent.seat}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-mono text-gray-500 truncate">
                                        {agent.agent.slice(0, 8)}…{agent.agent.slice(-6)}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        {agent.chipsEth} PAS chips
                                        {agent.kicked && " · Kicked"}
                                        {agent.folded && " · Folded"}
                                        {!agent.kicked && !agent.folded && agent.missedTurns > 0 &&
                                            ` · ${agent.missedTurns} miss${agent.missedTurns > 1 ? "es" : ""}`}
                                    </div>
                                </div>
                                {/* Bet on this agent */}
                                {betWindowOpen && !agent.kicked && (
                                    <button
                                        onClick={() => setBetSeat(betSeat === agent.seat ? null : agent.seat)}
                                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${betSeat === agent.seat
                                                ? "bg-violet-500 text-white"
                                                : "bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600"
                                            }`}
                                    >
                                        {betSeat === agent.seat ? "Selected" : "Bet"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400">No agents have joined yet.</p>
                )}
            </div>

            {/* Bet form */}
            {betWindowOpen && betSeat !== null && (
                <div className="px-5 mb-4">
                    <div className="bg-violet-50 rounded-2xl p-4">
                        <p className="text-sm font-semibold text-violet-700 mb-3">
                            Betting on Agent #{betSeat}
                        </p>
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">Amount (PAS)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    value={betAmount}
                                    onChange={e => setBetAmount(e.target.value)}
                                    className="w-full text-sm px-3 py-2 border border-violet-200 rounded-xl bg-white focus:outline-none focus:border-violet-400"
                                />
                            </div>
                            {["0.01", "0.05", "0.1"].map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setBetAmount(amt)}
                                    className={`px-3 py-2 text-xs rounded-xl border transition-colors mt-5 ${betAmount === amt
                                            ? "border-violet-500 bg-violet-500 text-white"
                                            : "border-gray-200 text-gray-500 hover:border-violet-300"
                                        }`}
                                >
                                    {amt}
                                </button>
                            ))}
                        </div>
                        {betError && <p className="text-xs text-red-500 mb-2">{betError}</p>}
                        <button
                            onClick={handleBet}
                            disabled={betLoading}
                            className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
                        >
                            {betLoading ? "Placing bet…" : `Place ${betAmount} PAS bet`}
                        </button>
                    </div>
                </div>
            )}

            {/* Claim actions (ended) */}
            {(isEnded || isCancelled) && (
                <div className="px-5 mb-4">
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        {isEnded ? "Claim your winnings" : "Request Refund"}
                    </h2>
                    <div className="space-y-2">
                        {isEnded && (
                            <>
                                <button
                                    onClick={() => handleClaim("chips")}
                                    disabled={claimLoading}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium text-sm py-3 rounded-xl transition-colors"
                                >
                                    {claimLoading ? "Claiming…" : "Claim Chips (as agent)"}
                                </button>
                                <button
                                    onClick={() => handleClaim("prize")}
                                    disabled={claimLoading}
                                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium text-sm py-3 rounded-xl transition-colors"
                                >
                                    {claimLoading ? "Claiming…" : "Claim Prize Pool (winner)"}
                                </button>
                                <button
                                    onClick={() => handleClaim("bet")}
                                    disabled={claimLoading}
                                    className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-medium text-sm py-3 rounded-xl transition-colors"
                                >
                                    {claimLoading ? "Claiming…" : "Claim Bet Winnings"}
                                </button>
                            </>
                        )}
                        {isCancelled && (
                            <button
                                onClick={() => handleClaim("refund")}
                                disabled={claimLoading}
                                className="w-full bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white font-medium text-sm py-3 rounded-xl transition-colors"
                            >
                                {claimLoading ? "Processing…" : "Get Full Refund"}
                            </button>
                        )}
                        {claimError && <p className="text-xs text-red-500 mt-2">{claimError}</p>}
                    </div>
                </div>
            )}

            {/* Session ended banner */}
            {isEnded && (
                <div className="mx-5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">
                        Session complete · {table.sessionLength} hands played
                    </p>
                </div>
            )}
        </div>
    );
}
