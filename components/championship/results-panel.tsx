"use client";

import type { ChallengeAgent, ChallengePayout } from "@/app/types/frontend_type";
import { AgentCard } from "./agent-card";
import { Trophy, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatPlanckAsDot } from "@/lib/format";

interface ResultsPanelProps {
  agents: ChallengeAgent[];
  winnerAgentId?: string;
  payouts: ChallengePayout[];
  totalEntryPool: string;
  totalBetPool: string;
}

export function ResultsPanel({
  agents,
  winnerAgentId,
  payouts,
  totalEntryPool,
  totalBetPool,
}: ResultsPanelProps) {
  const entryPayouts = payouts.filter(
    (p) => p.payoutType === "entry_prize" || p.payoutType === "platform_entry_fee"
  );
  const betPayouts = payouts.filter(
    (p) => p.payoutType === "bet_winnings" || p.payoutType === "platform_bet_fee"
  );

  return (
    <div className="space-y-4">
      {/* Pool summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-violet-50 rounded-xl">
          <p className="text-xs text-violet-500 font-medium">Entry Pool</p>
          <p className="text-lg font-bold text-violet-700">
            {formatPlanckAsDot(totalEntryPool)}
          </p>
          <p className="text-[10px] text-violet-400">95% to winner / 5% platform</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-xl">
          <p className="text-xs text-amber-500 font-medium">Bet Pool</p>
          <p className="text-lg font-bold text-amber-700">
            {formatPlanckAsDot(totalBetPool)}
          </p>
          <p className="text-[10px] text-amber-400">98% to winners / 2% platform</p>
        </div>
      </div>

      {/* Rankings */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Final Rankings
        </h3>
        <div className="space-y-2">
          {agents.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              rank={i + 1}
              isWinner={agent.id === winnerAgentId}
              showVotes
            />
          ))}
        </div>
      </div>

      {/* Payouts */}
      {payouts.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Payouts</h3>
          <div className="space-y-2">
            {payouts.map((payout, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  {payout.payoutType.includes("platform") ? (
                    <ArrowUpRight className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {payout.payoutType === "entry_prize"
                        ? "Entry Prize"
                        : payout.payoutType === "bet_winnings"
                        ? "Bet Winnings"
                        : payout.payoutType === "platform_entry_fee"
                        ? "Platform Fee (Entry)"
                        : "Platform Fee (Bets)"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {payout.recipient.slice(0, 6)}...{payout.recipient.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatPlanckAsDot(payout.amountDot)}
                  </p>
                  <span
                    className={`text-[10px] ${
                      payout.status === "completed"
                        ? "text-green-500"
                        : payout.status === "pending"
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    {payout.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
