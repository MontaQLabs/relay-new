"use client";

import type { ChallengeStatus } from "@/app/types/frontend_type";
import { UserPlus, Swords, Scale, Trophy } from "lucide-react";

interface PhaseTimelineProps {
  status: ChallengeStatus;
  enrollEnd: string;
  competeEnd: string;
  judgeEnd: string;
}

const phases: { key: ChallengeStatus; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "enrolling", label: "Enroll", Icon: UserPlus },
  { key: "competing", label: "Compete", Icon: Swords },
  { key: "judging", label: "Judge", Icon: Scale },
  { key: "completed", label: "Results", Icon: Trophy },
];

const statusOrder: ChallengeStatus[] = ["enrolling", "competing", "judging", "completed"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PhaseTimeline({ status, enrollEnd, competeEnd, judgeEnd }: PhaseTimelineProps) {
  const currentIndex = statusOrder.indexOf(status);

  const deadlines: Record<string, string> = {
    enrolling: enrollEnd,
    competing: competeEnd,
    judging: judgeEnd,
    completed: judgeEnd,
  };

  return (
    <div className="flex items-center w-full gap-1">
      {phases.map((phase, i) => {
        const isActive = phase.key === status;
        const isPast = statusOrder.indexOf(phase.key) < currentIndex;
        const isFuture = statusOrder.indexOf(phase.key) > currentIndex;
        const { Icon } = phase;

        return (
          <div key={phase.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all ${
                  isActive
                    ? "bg-violet-500 text-white ring-2 ring-violet-200"
                    : isPast
                    ? "bg-violet-100 text-violet-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive
                    ? "text-violet-600"
                    : isPast
                    ? "text-violet-400"
                    : "text-gray-400"
                }`}
              >
                {phase.label}
              </span>
              {phase.key !== "completed" && (
                <span className="text-[9px] text-gray-400">
                  {formatDate(deadlines[phase.key])}
                </span>
              )}
            </div>
            {i < phases.length - 1 && (
              <div
                className={`h-0.5 flex-shrink-0 w-4 -mt-4 ${
                  isPast ? "bg-violet-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
