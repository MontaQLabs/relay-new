"use client";

import type { ChallengeAgent } from "@/app/types/frontend_type";
import { ExternalLink, GitBranch, Globe, Trophy } from "lucide-react";

interface AgentCardProps {
  agent: ChallengeAgent;
  rank?: number;
  isWinner?: boolean;
  showVotes?: boolean;
  actionButton?: React.ReactNode;
}

export function AgentCard({ agent, rank, isWinner, showVotes, actionButton }: AgentCardProps) {
  return (
    <div
      className={`p-4 border rounded-xl transition-all ${
        isWinner
          ? "border-amber-300 bg-amber-50"
          : "border-gray-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank !== undefined && (
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                rank === 1
                  ? "bg-amber-400 text-white"
                  : rank === 2
                  ? "bg-gray-300 text-gray-700"
                  : rank === 3
                  ? "bg-orange-300 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {rank}
            </span>
          )}
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center gap-1.5">
              {agent.agentName}
              {isWinner && <Trophy className="w-4 h-4 text-amber-500" />}
            </h4>
            <p className="text-xs text-gray-400">
              by {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
            </p>
          </div>
        </div>
        {showVotes && (
          <div className="text-right">
            <span className="text-sm font-semibold text-violet-600">
              {agent.totalVotes}
            </span>
            <p className="text-xs text-gray-400">votes</p>
          </div>
        )}
      </div>

      {agent.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {agent.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs">
        {agent.repoUrl && (
          <a
            href={agent.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-violet-600 hover:text-violet-700"
            onClick={(e) => e.stopPropagation()}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {agent.commitHash && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-gray-400 font-mono">{agent.commitHash.slice(0, 7)}</span>
          </>
        )}
        {agent.endpointUrl && (
          <>
            <span className="text-gray-300">|</span>
            <a
              href={agent.endpointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-500 hover:text-gray-600"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Endpoint</span>
            </a>
          </>
        )}
        {!agent.entryVerified && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-amber-500 text-xs">Payment pending</span>
          </>
        )}
      </div>

      {actionButton && <div className="mt-3">{actionButton}</div>}
    </div>
  );
}
