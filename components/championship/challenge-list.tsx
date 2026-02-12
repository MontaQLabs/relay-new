"use client";

import { useRouter } from "next/navigation";
import type { Challenge } from "@/app/types/frontend_type";
import { ChallengeCard } from "./challenge-card";

export interface ChallengeListProps {
  challenges: Challenge[];
}

export function ChallengeList({ challenges }: ChallengeListProps) {
  const router = useRouter();

  const handleClick = (challengeId: string) => {
    router.push(`/dashboard/championship/${challengeId}`);
  };

  return (
    <div className="flex flex-col gap-3">
      {challenges.map((challenge) => (
        <ChallengeCard
          key={challenge.challengeId}
          challenge={challenge}
          onClick={() => handleClick(challenge.challengeId)}
        />
      ))}
    </div>
  );
}
