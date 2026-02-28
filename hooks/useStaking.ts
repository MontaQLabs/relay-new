"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPoolSummariesPaginated,
  fetchPoolDetails,
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
  PoolSummary,
  PoolDetails,
  StakingAccountStatus,
  StakingTransactionResult,
} from "@/app/types/frontend_type";

// Default page size for pool pagination
const DEFAULT_PAGE_SIZE = 5;

interface UseStakingReturn {
  // Data - Pool summaries for list (lazy loading with pagination)
  poolSummaries: PoolSummary[];
  // Pagination state
  currentPage: number;
  totalPages: number;
  totalPools: number;
  pageSize: number;
  // Full pool details (fetched on demand)
  selectedPoolDetails: PoolDetails | null;
  // Account status
  accountStatus: StakingAccountStatus | null;
  isStaking: boolean;
  currentPoolId: number | null;
  stakedAmount: number;
  pendingRewards: number;
  spendableBalance: number;

  // Loading states
  isLoadingPools: boolean;
  isLoadingPoolDetails: boolean;
  isLoadingStatus: boolean;
  isLoading: boolean;

  // Error
  error: string | null;

  // Actions
  refetch: (forceRefresh?: boolean) => Promise<void>;
  refetchPools: (forceRefresh?: boolean) => Promise<void>;
  refetchStatus: () => Promise<void>;
  loadPoolDetails: (poolId: number) => Promise<PoolDetails | null>;
  clearPoolDetails: () => void;
  // Pagination actions
  goToPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
}

/**
 * Hook for fetching and managing staking data
 * Uses lazy loading with pagination: fetches pool summaries for current page only,
 * then fetches details on demand when user clicks a pool
 */
export function useStaking(): UseStakingReturn {
  // Pool summaries (lightweight, for list display) - only current page
  const [poolSummaries, setPoolSummaries] = useState<PoolSummary[]>([]);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalPools, setTotalPools] = useState(0);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  // Selected pool details (fetched on demand when user clicks a pool)
  const [selectedPoolDetails, setSelectedPoolDetails] = useState<PoolDetails | null>(null);
  const [accountStatus, setAccountStatus] = useState<StakingAccountStatus | null>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [isLoadingPoolDetails, setIsLoadingPoolDetails] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch paginated pool summaries for a specific page
  const fetchPoolsPage = useCallback(
    async (page: number, forceRefresh = false) => {
      setIsLoadingPools(true);
      setError(null);

      try {
        // Use paginated fetch - only fetches metadata for current page's pools
        const result = await fetchPoolSummariesPaginated(page, pageSize, forceRefresh);
        setPoolSummaries(result.pools);
        setCurrentPage(result.currentPage);
        setTotalPages(result.totalPages);
        setTotalPools(result.totalPools);
      } catch (err) {
        console.error("Failed to fetch pool summaries:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch pools");
      } finally {
        setIsLoadingPools(false);
      }
    },
    [pageSize]
  );

  // Go to a specific page
  const goToPage = useCallback(
    async (page: number) => {
      if (page < 1 || page > totalPages) return;
      await fetchPoolsPage(page);
    },
    [fetchPoolsPage, totalPages]
  );

  // Go to next page
  const nextPage = useCallback(async () => {
    if (currentPage < totalPages) {
      await fetchPoolsPage(currentPage + 1);
    }
  }, [currentPage, totalPages, fetchPoolsPage]);

  // Go to previous page
  const previousPage = useCallback(async () => {
    if (currentPage > 1) {
      await fetchPoolsPage(currentPage - 1);
    }
  }, [currentPage, fetchPoolsPage]);

  // Fetch full details for a specific pool (on demand)
  const loadPoolDetails = useCallback(async (poolId: number): Promise<PoolDetails | null> => {
    setIsLoadingPoolDetails(true);

    try {
      const details = await fetchPoolDetails(poolId);
      setSelectedPoolDetails(details);
      return details;
    } catch (err) {
      console.error("Failed to fetch pool details:", err);
      return null;
    } finally {
      setIsLoadingPoolDetails(false);
    }
  }, []);

  // Clear selected pool details
  const clearPoolDetails = useCallback(() => {
    setSelectedPoolDetails(null);
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

  // Refetch current page and status
  const refetch = useCallback(
    async (forceRefresh = false) => {
      await Promise.all([fetchPoolsPage(currentPage, forceRefresh), fetchStatus()]);
    },
    [fetchPoolsPage, fetchStatus, currentPage]
  );

  // Refetch pools (current page)
  const refetchPools = useCallback(
    async (forceRefresh = false) => {
      await fetchPoolsPage(currentPage, forceRefresh);
    },
    [fetchPoolsPage, currentPage]
  );

  // Initial fetch on mount - page 1
  useEffect(() => {
    Promise.all([fetchPoolsPage(1), fetchStatus()]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed values
  const isStaking = accountStatus?.nominationPool.pool !== null;
  const currentPoolId = accountStatus?.nominationPool.pool ?? null;
  const stakedAmount = accountStatus ? planckToDot(accountStatus.nominationPool.currentBond) : 0;
  const pendingRewards = accountStatus
    ? planckToDot(accountStatus.nominationPool.pendingRewards)
    : 0;
  const spendableBalance = accountStatus ? planckToDot(accountStatus.balance.spendable) : 0;

  return {
    poolSummaries,
    currentPage,
    totalPages,
    totalPools,
    pageSize,
    selectedPoolDetails,
    accountStatus,
    isStaking,
    currentPoolId,
    stakedAmount,
    pendingRewards,
    spendableBalance,
    isLoadingPools,
    isLoadingPoolDetails,
    isLoadingStatus,
    isLoading: isLoadingPools || isLoadingStatus,
    error,
    refetch,
    refetchPools,
    refetchStatus: fetchStatus,
    loadPoolDetails,
    clearPoolDetails,
    goToPage,
    nextPage,
    previousPage,
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

  const estimateFee = useCallback(async (poolId: number, amount: number) => {
    return estimateJoinPoolFee(poolId, amount);
  }, []);

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
