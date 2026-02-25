"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spade, Trophy, Clock, Zap, Plus } from "lucide-react";
import { usePokerTables } from "@/hooks/usePoker";
import { formatEther } from "viem";
import { TABLE_STATE, TABLE_STATE_LABEL } from "@/app/services/poker/contract";
import type { TableInfo } from "@/app/services/poker";

const STATE_COLORS: Record<number, string> = {
    0: "bg-emerald-100 text-emerald-700",  // Open
    1: "bg-violet-100 text-violet-700",    // Playing
    2: "bg-gray-100 text-gray-500",        // Ended
    3: "bg-red-100 text-red-500",          // Cancelled
};

function TableCard({ table, onClick }: { table: TableInfo; onClick: () => void }) {
    const deadline = new Date(Number(table.betDeadline) * 1000);
    const open = table.state === TABLE_STATE.OPEN;

    return (
        <button
            onClick={onClick}
            className="w-full text-left flex items-center gap-4 py-4 border-b border-gray-100 last:border-0 group"
        >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${table.state === TABLE_STATE.PLAYING ? "bg-violet-50" :
                    table.state === TABLE_STATE.OPEN ? "bg-emerald-50" : "bg-gray-50"
                }`}>
                {table.state === TABLE_STATE.PLAYING ? (
                    <Zap className="w-5 h-5 text-violet-500" />
                ) : table.state === TABLE_STATE.OPEN ? (
                    <Clock className="w-5 h-5 text-emerald-500" />
                ) : (
                    <Trophy className="w-5 h-5 text-gray-400" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-black">Table #{table.tableId}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATE_COLORS[table.state]}`}>
                        {table.stateLabel}
                    </span>
                </div>
                <div className="text-xs text-gray-500 space-x-2">
                    <span>{table.agentCount}/{table.maxAgents} agents</span>
                    <span>·</span>
                    <span>Buy-in {table.buyInEth} PAS</span>
                    <span>·</span>
                    <span>Prize {table.prizePoolEth} PAS</span>
                </div>
                {open && (
                    <div className="text-xs text-amber-600 mt-0.5">
                        Bets close {deadline.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                )}
                {table.state === TABLE_STATE.PLAYING && (
                    <div className="text-xs text-violet-600 mt-0.5">
                        Hand {table.currentHand} of {table.sessionLength}
                    </div>
                )}
            </div>

            {/* Chevron */}
            <div className="text-gray-300 group-hover:text-gray-500 transition-colors text-lg">›</div>
        </button>
    );
}

type TabType = "All" | "Open" | "Live" | "Ended";

const TAB_STATE: Record<TabType, number | undefined> = {
    All: undefined,
    Open: TABLE_STATE.OPEN,
    Live: TABLE_STATE.PLAYING,
    Ended: TABLE_STATE.ENDED,
};

export default function PokerArenaPage() {
    const router = useRouter();
    const [tab, setTab] = useState<TabType>("All");
    const { tables, isLoading } = usePokerTables(TAB_STATE[tab]);

    return (
        <div className="flex flex-col animate-fade-in">
            {/* Header */}
            <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                    <Spade className="w-5 h-5 text-violet-600" />
                    <h1 className="text-xl font-bold text-black">Poker Arena</h1>
                </div>
                <p className="text-sm text-gray-500">
                    Watch AI agents compete · Bet on your favourite bot · Win PAS
                </p>
            </div>

            {/* Create table CTA */}
            <div className="px-5 mb-3">
                <button
                    onClick={() => router.push("/dashboard/poker/create")}
                    className="flex items-center gap-3 w-full bg-violet-50 hover:bg-violet-100 transition-colors rounded-2xl px-4 py-3"
                >
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="text-left">
                        <div className="font-semibold text-sm text-violet-700">Create a Table</div>
                        <div className="text-xs text-violet-500">Set the prize pool, invite bots</div>
                    </div>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-5 px-5 border-b border-gray-100 mb-1">
                {(["All", "Open", "Live", "Ended"] as TabType[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t
                                ? "border-violet-500 text-violet-600"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Table list */}
            <div className="px-5">
                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                ) : tables.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            <Spade className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="font-semibold text-gray-700 mb-1">No tables yet</h3>
                        <p className="text-sm text-gray-400 max-w-[240px]">
                            {tab === "Open" ? "No tables accepting bets right now." :
                                tab === "Live" ? "No games in progress." :
                                    "Create a table to get started."}
                        </p>
                    </div>
                ) : (
                    <div>
                        {tables.map(t => (
                            <TableCard
                                key={t.tableId}
                                table={t}
                                onClick={() => router.push(`/dashboard/poker/${t.tableId}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
