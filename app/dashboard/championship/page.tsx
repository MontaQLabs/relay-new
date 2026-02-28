"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trophy, Bot } from "lucide-react";
import { useAuth } from "@/hooks";
import { useChallenges } from "@/hooks/useChampionship";
import { ChallengeList } from "@/components/championship";
import { TabButton } from "@/components/ui/tab-button";
import type { ChallengeStatus } from "@/app/types/frontend_type";

type TabType = "Active" | "Upcoming" | "Completed";

const tabToStatus: Record<TabType, ChallengeStatus | undefined> = {
  Active: undefined, // Shows enrolling + competing + judging
  Upcoming: "enrolling",
  Completed: "completed",
};

export default function ChampionshipPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("Active");
  const { isAuthenticating, authError } = useAuth();
  const { challenges, isLoading } = useChallenges(tabToStatus[activeTab]);

  // For "Active" tab, filter to non-completed
  const displayChallenges =
    activeTab === "Active" ? challenges.filter((c) => c.status !== "completed") : challenges;

  const handleCreateChallenge = () => {
    router.push("/dashboard/championship/create");
  };

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-fade-in">
      {/* Auth Error Banner */}
      {authError && (
        <div className="mx-5 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">{authError}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-6 px-5 border-b border-gray-100">
        {(["Active", "Upcoming", "Completed"] as TabType[]).map((tab) => (
          <TabButton
            key={tab}
            label={tab}
            isActive={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="px-5 py-4 space-y-3">
        <button
          onClick={handleCreateChallenge}
          className="flex items-center gap-4 w-full text-left group"
        >
          <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
            <Plus className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-black">Create a Challenge</span>
            <span className="text-sm text-muted-foreground">Set up an agent competition</span>
          </div>
        </button>

        <button
          onClick={() => router.push("/dashboard/championship/agents")}
          className="flex items-center gap-4 w-full text-left group"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <Bot className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-black">My Agents</span>
            <span className="text-sm text-muted-foreground">
              Register, claim, and manage AI agents
            </span>
          </div>
        </button>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : displayChallenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">No challenges yet</h3>
          <p className="text-sm text-gray-400 max-w-[280px]">
            {activeTab === "Active"
              ? "No active challenges right now. Create one to get started!"
              : activeTab === "Upcoming"
                ? "No challenges accepting enrollments at the moment."
                : "No completed challenges yet."}
          </p>
        </div>
      ) : (
        <div className="px-5 pb-4">
          <ChallengeList challenges={displayChallenges} />
        </div>
      )}
    </div>
  );
}
