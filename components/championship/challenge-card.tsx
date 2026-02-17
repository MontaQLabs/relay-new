"use client";

import type { Challenge } from "@/app/types/frontend_type";
import { Trophy, Users, Clock, Coins } from "lucide-react";
import { formatPlanckAsDot } from "@/lib/format";

interface ChallengeCardProps {
  challenge: Challenge;
  onClick: () => void;
}

function getStatusColor(status: Challenge["status"]): string {
  switch (status) {
    case "enrolling":
      return "bg-blue-100 text-blue-700";
    case "competing":
      return "bg-amber-100 text-amber-700";
    case "judging":
      return "bg-purple-100 text-purple-700";
    case "completed":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getStatusLabel(status: Challenge["status"]): string {
  switch (status) {
    case "enrolling":
      return "Enrolling";
    case "competing":
      return "Competing";
    case "judging":
      return "Judging";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

function getTimeRemaining(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "Ended";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function getCurrentDeadline(challenge: Challenge): string {
  switch (challenge.status) {
    case "enrolling":
      return challenge.startTime;
    case "competing":
      return challenge.endTime;
    case "judging":
      return challenge.judgeEnd;
    default:
      return challenge.judgeEnd;
  }
}

export function ChallengeCard({ challenge, onClick }: ChallengeCardProps) {
  const statusColor = getStatusColor(challenge.status);
  const statusLabel = getStatusLabel(challenge.status);
  const deadline = getCurrentDeadline(challenge);
  const timeRemaining = getTimeRemaining(deadline);

  const totalPoolEntry = BigInt(challenge.totalEntryPoolDot || "0");
  const totalPoolBet = BigInt(challenge.totalBetPoolDot || "0");
  const totalPool = totalPoolEntry + totalPoolBet;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-white border border-gray-100 rounded-xl hover:border-violet-200 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-base leading-tight pr-3">
          {challenge.title}
        </h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <p className="text-sm text-gray-500 line-clamp-2 mb-3">
        {challenge.description}
      </p>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <span>{challenge.agentCount || 0} agents</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="w-3.5 h-3.5" />
          <span>Entry: {formatPlanckAsDot(challenge.entryFeeDot)}</span>
        </div>
        {totalPool > BigInt(0) && (
          <div className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>Pool: {formatPlanckAsDot(totalPool.toString())}</span>
          </div>
        )}
        {challenge.status !== "completed" && (
          <div className="flex items-center gap-1 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeRemaining}</span>
          </div>
        )}
      </div>
    </button>
  );
}
