"use client";

import { useState, useCallback } from "react";
import { Coins, RefreshCw } from "lucide-react";
import { TabButton } from "@/components/ui/tab-button";
import {
  StakingStatusCard,
  PoolList,
  PoolDetailSheet,
  StakeActionSheet,
} from "@/components/staking";
import { useStaking, useStakingActions } from "@/hooks";

type TabType = "My Stake" | "Pools";

export default function StakingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("Pools");
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [actionSheetType, setActionSheetType] = useState<"stake" | "unbond" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Staking data hook (with lazy loading and pagination)
  const {
    poolSummaries,
    currentPage,
    totalPages,
    totalPools,
    selectedPoolDetails,
    accountStatus,
    isStaking,
    currentPoolId,
    stakedAmount,
    spendableBalance,
    isLoading,
    isLoadingPools,
    isLoadingPoolDetails,
    error,
    refetch,
    loadPoolDetails,
    clearPoolDetails,
    nextPage,
    previousPage,
    goToPage,
  } = useStaking();

  // Staking actions hook
  const {
    joinPool,
    stakeMore,
    unbond,
    claimRewards,
    withdraw,
    isSubmitting,
  } = useStakingActions();

  // Handle refresh - force refresh bypasses cache
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch(true); // Force refresh to bypass localStorage cache
    setIsRefreshing(false);
  }, [refetch]);

  // Handle pool selection - lazy load details
  const handlePoolSelect = useCallback(async (poolId: number) => {
    setIsDetailSheetOpen(true);
    await loadPoolDetails(poolId);
  }, [loadPoolDetails]);

  // Handle closing the detail sheet
  const handleCloseDetailSheet = useCallback(() => {
    setIsDetailSheetOpen(false);
    clearPoolDetails();
  }, [clearPoolDetails]);

  // Handle join pool
  const handleJoinPool = async (poolId: number, amount: number) => {
    const result = await joinPool(poolId, amount);
    if (result.success) {
      handleCloseDetailSheet();
      await refetch();
      setActiveTab("My Stake");
    } else {
      throw new Error(result.error);
    }
  };

  // Handle stake more
  const handleStakeMore = async (amount: number) => {
    const result = await stakeMore(amount);
    if (result.success) {
      await refetch();
    } else {
      throw new Error(result.error);
    }
  };

  // Handle unbond
  const handleUnbond = async (amount: number) => {
    const result = await unbond(amount);
    if (result.success) {
      await refetch();
    } else {
      throw new Error(result.error);
    }
  };

  // Handle claim rewards
  const handleClaimRewards = async () => {
    const result = await claimRewards();
    if (result.success) {
      await refetch();
    } else {
      console.error("Failed to claim rewards:", result.error);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    const result = await withdraw();
    if (result.success) {
      await refetch();
    } else {
      console.error("Failed to withdraw:", result.error);
    }
  };

  return (
    <div className="flex flex-col animate-fade-in">
      {/* Header Section */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-violet-500" />
            <h1 className="text-xl font-bold text-black">Staking</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-5 h-5 text-gray-500 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-6 px-5 border-b border-gray-100">
        {(["My Stake", "Pools"] as TabType[]).map((tab) => (
          <TabButton
            key={tab}
            label={tab}
            isActive={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* My Stake Tab */}
          {activeTab === "My Stake" && (
            <div className="px-5 py-4">
              {isStaking && accountStatus ? (
                <StakingStatusCard
                  accountStatus={accountStatus}
                  currentPool={
                    currentPoolId
                      ? poolSummaries.find((p) => p.id === currentPoolId) ?? null
                      : null
                  }
                  onStakeMore={() => setActionSheetType("stake")}
                  onUnbond={() => setActionSheetType("unbond")}
                  onClaimRewards={handleClaimRewards}
                  onWithdraw={handleWithdraw}
                />
              ) : (
                <EmptyStakingState onBrowsePools={() => setActiveTab("Pools")} />
              )}
            </div>
          )}

          {/* Pools Tab */}
          {activeTab === "Pools" && (
            <div className="bg-white rounded-t-3xl border-t border-gray-100 mt-2">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-black">
                  Available Pools
                </h2>
                <p className="text-sm text-muted-foreground">
                  {totalPools} open pool{totalPools !== 1 ? "s" : ""} available
                </p>
              </div>
              <PoolList
                pools={poolSummaries}
                onPoolSelect={handlePoolSelect}
                isLoading={isLoadingPools}
                currentPage={currentPage}
                totalPages={totalPages}
                totalPools={totalPools}
                onNextPage={nextPage}
                onPreviousPage={previousPage}
                onGoToPage={goToPage}
              />
            </div>
          )}
        </>
      )}

      {/* Pool Detail Sheet (lazy loaded) */}
      <PoolDetailSheet
        poolDetails={selectedPoolDetails}
        isOpen={isDetailSheetOpen}
        isLoadingDetails={isLoadingPoolDetails}
        onClose={handleCloseDetailSheet}
        onJoin={handleJoinPool}
        spendableBalance={spendableBalance}
        isSubmitting={isSubmitting}
      />

      {/* Stake/Unbond Action Sheet */}
      <StakeActionSheet
        isOpen={actionSheetType !== null}
        onClose={() => setActionSheetType(null)}
        actionType={actionSheetType || "stake"}
        onConfirm={actionSheetType === "stake" ? handleStakeMore : handleUnbond}
        maxAmount={actionSheetType === "stake" ? spendableBalance : stakedAmount}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

// Empty state component for when user is not staking
function EmptyStakingState({ onBrowsePools }: { onBrowsePools: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mb-4">
        <Coins className="w-10 h-10 text-violet-500" />
      </div>
      <h3 className="text-lg font-semibold text-black mb-2">
        Start Earning Rewards
      </h3>
      <p className="text-sm text-muted-foreground max-w-[280px] mb-6">
        Stake your DOT in a nomination pool to earn staking rewards without running a validator.
      </p>
      <button
        onClick={onBrowsePools}
        className="bg-violet-500 hover:bg-violet-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
      >
        Browse Pools
      </button>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3 mt-8 w-full">
        <div className="bg-gray-50 rounded-2xl p-4 text-left">
          <p className="text-2xl font-bold text-violet-500 mb-1">~15%</p>
          <p className="text-xs text-muted-foreground">Estimated APY</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 text-left">
          <p className="text-2xl font-bold text-violet-500 mb-1">1 DOT</p>
          <p className="text-xs text-muted-foreground">Minimum Stake</p>
        </div>
      </div>
    </div>
  );
}
