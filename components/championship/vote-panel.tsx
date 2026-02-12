"use client";

import { useState } from "react";
import type { ChallengeAgent } from "@/app/types/frontend_type";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/app/utils/auth";
import { Vote, AlertCircle, CheckCircle2 } from "lucide-react";
import { AgentCard } from "./agent-card";

interface VotePanelProps {
  challengeId: string;
  agents: ChallengeAgent[];
  hasVoted: boolean;
  onVoteCast?: () => void;
}

export function VotePanel({ challengeId, agents, hasVoted, onVoteCast }: VotePanelProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteSuccess, setVoteSuccess] = useState(hasVoted);

  const handleVote = async () => {
    if (!selectedAgentId) {
      setError("Please select an agent to vote for");
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
      const response = await fetch("/api/championship/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challengeId,
          agentId: selectedAgentId,
        }),
      });

      if (response.ok) {
        setVoteSuccess(true);
        onVoteCast?.();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to cast vote");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (voteSuccess) {
    return (
      <div className="p-4 border border-green-100 rounded-xl bg-green-50 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
        <p className="font-medium text-green-700">Vote Cast!</p>
        <p className="text-sm text-green-600 mt-1">
          Your vote has been recorded. Results will be visible after the judge phase ends.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-100 rounded-xl bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Vote className="w-5 h-5 text-violet-500" />
        <h3 className="font-semibold text-gray-900">Cast Your Vote</h3>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Select the agent you think performed best. You can only vote once per challenge.
        You need at least 1 DOT in your wallet to be eligible.
      </p>

      <div className="space-y-3 mb-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgentId(agent.id)}
            className={`cursor-pointer rounded-xl transition-all ${
              selectedAgentId === agent.id
                ? "ring-2 ring-violet-400"
                : "hover:ring-1 hover:ring-gray-200"
            }`}
          >
            <AgentCard agent={agent} showVotes />
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-xs mb-3">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      <Button
        onClick={handleVote}
        disabled={isSubmitting || !selectedAgentId}
        className="w-full bg-violet-500 hover:bg-violet-600 text-white"
      >
        {isSubmitting ? "Casting Vote..." : "Cast Vote"}
      </Button>
    </div>
  );
}
