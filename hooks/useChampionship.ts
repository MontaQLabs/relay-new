"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Challenge,
  ChallengeAgent,
  ChallengeStatus,
  ChallengeBet,
  ChallengePayout,
} from "@/app/types/frontend_type";

// ============================================================================
// Challenge List Hook
// ============================================================================

interface UseChallengesReturn {
  challenges: Challenge[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useChallenges(status?: ChallengeStatus): UseChallengesReturn {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = status ? `/api/championship?status=${status}` : "/api/championship";
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch challenges");
      }

      const data = await response.json();
      setChallenges(data.challenges || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load challenges");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  return { challenges, isLoading, error, refetch: fetchChallenges };
}

// ============================================================================
// Challenge Detail Hook
// ============================================================================

interface UseChallengeDetailReturn {
  challenge: Challenge | null;
  agents: ChallengeAgent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useChallengeDetail(challengeId: string): UseChallengeDetailReturn {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [agents, setAgents] = useState<ChallengeAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [challengeRes, agentsRes] = await Promise.all([
        fetch(`/api/championship/${challengeId}`),
        fetch(`/api/championship/${challengeId}/agents`),
      ]);

      if (!challengeRes.ok) {
        throw new Error("Challenge not found");
      }

      const challengeData = await challengeRes.json();
      setChallenge(challengeData.challenge);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.agents || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load challenge");
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (challengeId) {
      fetchDetail();
    }
  }, [fetchDetail, challengeId]);

  return { challenge, agents, isLoading, error, refetch: fetchDetail };
}

// ============================================================================
// Challenge Results Hook
// ============================================================================

interface UseChallengeResultsReturn {
  agents: ChallengeAgent[];
  winnerAgentId?: string;
  payouts: ChallengePayout[];
  totalEntryPool: string;
  totalBetPool: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useChallengeResults(challengeId: string): UseChallengeResultsReturn {
  const [agents, setAgents] = useState<ChallengeAgent[]>([]);
  const [winnerAgentId, setWinnerAgentId] = useState<string | undefined>();
  const [payouts, setPayouts] = useState<ChallengePayout[]>([]);
  const [totalEntryPool, setTotalEntryPool] = useState("0");
  const [totalBetPool, setTotalBetPool] = useState("0");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/championship/${challengeId}/results`);
      if (!response.ok) throw new Error("Failed to fetch results");

      const data = await response.json();
      setAgents(data.agents || []);
      setWinnerAgentId(data.winnerAgentId);
      setPayouts(data.payouts || []);
      setTotalEntryPool(data.totalEntryPool || "0");
      setTotalBetPool(data.totalBetPool || "0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (challengeId) {
      fetchResults();
    }
  }, [fetchResults, challengeId]);

  return {
    agents,
    winnerAgentId,
    payouts,
    totalEntryPool,
    totalBetPool,
    isLoading,
    error,
    refetch: fetchResults,
  };
}

// ============================================================================
// Bet Stats Hook
// ============================================================================

interface UseBetStatsReturn {
  totalPool: string;
  bets: ChallengeBet[];
  betsByAgent: Record<string, string>;
  isLoading: boolean;
  refetch: () => void;
}

export function useBetStats(challengeId: string, wallet?: string | null): UseBetStatsReturn {
  const [totalPool, setTotalPool] = useState("0");
  const [bets, setBets] = useState<ChallengeBet[]>([]);
  const [betsByAgent, setBetsByAgent] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchBets = useCallback(async () => {
    setIsLoading(true);

    try {
      const url = wallet
        ? `/api/championship/${challengeId}/bets?wallet=${wallet}`
        : `/api/championship/${challengeId}/bets`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setTotalPool(data.totalPool || "0");
        setBets(data.bets || []);
        setBetsByAgent(data.betsByAgent || {});
      }
    } catch {
      // Silently fail for bet stats
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, wallet]);

  useEffect(() => {
    if (challengeId) {
      fetchBets();
    }
  }, [fetchBets, challengeId]);

  return { totalPool, bets, betsByAgent, isLoading, refetch: fetchBets };
}
