"use client";

import { useState } from "react";
import type { ChallengeAgent } from "@/app/types/frontend_type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/app/utils/auth";
import { Coins, AlertCircle } from "lucide-react";
import { dotToPlanck, formatPlanckAsDot } from "@/lib/format";

interface BetPanelProps {
  challengeId: string;
  agents: ChallengeAgent[];
  totalBetPool: string;
  onBetPlaced?: () => void;
}

export function BetPanel({ challengeId, agents, totalBetPool, onBetPlaced }: BetPanelProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [amountDot, setAmountDot] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedAgentId || !amountDot || !txHash) {
      setError("Please fill in all fields");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("Please authenticate first");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/championship/bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challengeId,
          agentId: selectedAgentId,
          amountDot: dotToPlanck(amountDot),
          txHash: txHash.trim(),
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setAmountDot("");
        setTxHash("");
        setSelectedAgentId("");
        onBetPlaced?.();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to place bet");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 border border-gray-100 rounded-xl bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Coins className="w-5 h-5 text-violet-500" />
        <h3 className="font-semibold text-gray-900">Place a Bet</h3>
        <span className="text-xs text-gray-400 ml-auto">
          Pool: {formatPlanckAsDot(totalBetPool)}
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Predict the winner and bet DOT. Winners share 98% of the pool proportionally.
        2% platform fee applies.
      </p>

      {success ? (
        <div className="text-center py-4">
          <p className="text-green-600 font-medium">Bet placed successfully!</p>
          <button
            onClick={() => setSuccess(false)}
            className="text-sm text-violet-500 mt-2"
          >
            Place another bet
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Agent selection */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Select Agent</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              <option value="">Choose an agent...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.agentName} (by {agent.owner.slice(0, 6)}...)
                </option>
              ))}
            </select>
          </div>

          {/* DOT amount */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (DOT)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 1.5"
              value={amountDot}
              onChange={(e) => setAmountDot(e.target.value)}
            />
          </div>

          {/* Transaction hash */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Transaction Hash</label>
            <Input
              type="text"
              placeholder="0x... (after sending DOT to escrow)"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Send DOT to the escrow address first, then paste the tx hash here.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedAgentId || !amountDot || !txHash}
            className="w-full bg-violet-500 hover:bg-violet-600 text-white"
          >
            {isSubmitting ? "Placing Bet..." : "Place Bet"}
          </Button>
        </div>
      )}
    </div>
  );
}
