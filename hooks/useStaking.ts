"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchNominationPools,
  fetchAccountStakingStatus,
  joinNominationPool,
  bondExtra,
  unbondFromPool,
  claimPoolRewards,
  withdrawUnbonded,
  estimateJoinPoolFee,
  planckToDot,
} from "@/app/utils/staking";
import type {
  NominationPoolInfo,
  StakingAccountStatus,
  StakingTransactionResult,
} from "@/app/types/frontend_type";

interface UseStakingReturn {
  // Data
  pools: NominationPoolInfo[];
  accountStatus: StakingAccountStatus | null;
  isStaking: boolean;
  currentPoolId: number | null;
  currentPool: NominationPoolInfo | null;
  stakedAmount: number;
  pendingRewards: number;
  spendableBalance: number;

  // Loading states
  isLoadingPools: boolean;
  isLoadingStatus: boolean;
  isLoading: boolean;

  // Error
  error: string | null;

  // Actions
  refetch: () => Promise<void>;
  refetchPools: () => Promise<void>;
  refetchStatus: () => Promise<void>;
}

/**
 * Hook for fetching and managing staking data
 * Handles loading pools, account status, and provides computed values
 */
export function useStaking(): UseStakingReturn {
  const [pools, setPools] = useState<NominationPoolInfo[]>([]);
  const [accountStatus, setAccountStatus] = useState<StakingAccountStatus | null>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = useCallback(async () => {
    setIsLoadingPools(true);
    setError(null);

    try {
      const fetchedPools = await fetchNominationPools();
      setPools(fetchedPools);
    } catch (err) {
      console.error("Failed to fetch pools:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch pools");
    } finally {
      setIsLoadingPools(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);

    try {
      const status = await fetchAccountStakingStatus();
      setAccountStatus(status);
    } catch (err) {
      console.error("Failed to fetch account status:", err);
      // Don't set error for status - it's okay if user isn't staking
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await Promise.all([fetchPools(), fetchStatus()]);
  }, [fetchPools, fetchStatus]);

  // Initial fetch on mount
  useEffect(() => {
    refetch();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Computed values
  const isStaking = accountStatus?.nominationPool.pool !== null;
  const currentPoolId = accountStatus?.nominationPool.pool ?? null;
  const currentPool = currentPoolId
    ? pools.find((p) => p.id === currentPoolId) ?? null
    : null;
  const stakedAmount = accountStatus
    ? planckToDot(accountStatus.nominationPool.currentBond)
    : 0;
  const pendingRewards = accountStatus
    ? planckToDot(accountStatus.nominationPool.pendingRewards)
    : 0;
  const spendableBalance = accountStatus
    ? planckToDot(accountStatus.balance.spendable)
    : 0;

  return {
    pools,
    accountStatus,
    isStaking,
    currentPoolId,
    currentPool,
    stakedAmount,
    pendingRewards,
    spendableBalance,
    isLoadingPools,
    isLoadingStatus,
    isLoading: isLoadingPools || isLoadingStatus,
    error,
    refetch,
    refetchPools: fetchPools,
    refetchStatus: fetchStatus,
  };
}

interface UseStakingActionsReturn {
  // Actions
  joinPool: (poolId: number, amount: number) => Promise<StakingTransactionResult>;
  stakeMore: (amount: number) => Promise<StakingTransactionResult>;
  unbond: (amount: number) => Promise<StakingTransactionResult>;
  claimRewards: () => Promise<StakingTransactionResult>;
  withdraw: () => Promise<StakingTransactionResult>;
  estimateFee: (poolId: number, amount: number) => Promise<{ fee: string; feeFormatted: string }>;

  // State
  isSubmitting: boolean;
  lastResult: StakingTransactionResult | null;
}

/**
 * Hook for staking transaction actions
 * Provides functions to join pools, stake more, unbond, claim rewards, etc.
 */
export function useStakingActions(): UseStakingActionsReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<StakingTransactionResult | null>(null);

  const joinPool = useCallback(async (poolId: number, amount: number) => {
    setIsSubmitting(true);
    try {
      const result = await joinNominationPool(poolId, amount);
      setLastResult(result);
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const stakeMore = useCallback(async (amount: number) => {
    setIsSubmitting(true);
    try {
      const result = await bondExtra(amount);
      setLastResult(result);
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const unbond = useCallback(async (amount: number) => {
    setIsSubmitting(true);
    try {
      const result = await unbondFromPool(amount);
      setLastResult(result);
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const claimRewards = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await claimPoolRewards();
      setLastResult(result);
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const withdraw = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await withdrawUnbonded();
      setLastResult(result);
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const estimateFee = useCallback(
    async (poolId: number, amount: number) => {
      return estimateJoinPoolFee(poolId, amount);
    },
    []
  );

  return {
    joinPool,
    stakeMore,
    unbond,
    claimRewards,
    withdraw,
    estimateFee,
    isSubmitting,
    lastResult,
  };
}
