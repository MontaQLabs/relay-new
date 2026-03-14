"use client";

import { Coins, Gift, Clock } from "lucide-react";
import { formatStakingAmount, formatUnlockTime } from "@/lib/format";
import type { StakingAccountStatus, PoolSummary, StakingUnlock } from "@/app/types/frontend_type";
import { planckToDot } from "@/app/utils/staking";

interface StakingStatusCardProps {
  accountStatus: StakingAccountStatus;
  currentPool: PoolSummary | null;
  currentEra?: number;
  onStakeMore?: () => void;
  onUnbond?: () => void;
  onClaimRewards?: () => void;
  onWithdraw?: () => void;
}

export function StakingStatusCard({
  accountStatus,
  currentPool,
  currentEra = 0,
  onStakeMore,
  onUnbond,
  onClaimRewards,
  onWithdraw,
}: StakingStatusCardProps) {
  const stakedAmount = planckToDot(accountStatus.nominationPool.currentBond);
  const pendingRewards = planckToDot(accountStatus.nominationPool.pendingRewards);
  const unlocks = accountStatus.nominationPool.unlocks;
  const hasUnlocks = unlocks.length > 0;

  // Calculate total unlocking amount
  const totalUnlocking = unlocks.reduce((sum, unlock) => sum + planckToDot(unlock.value), 0);

  // Check if any unlocks are ready to withdraw
  const readyToWithdraw = unlocks.filter((unlock) => unlock.era <= currentEra);
  const totalReadyToWithdraw = readyToWithdraw.reduce(
    (sum, unlock) => sum + planckToDot(unlock.value),
    0
  );

  return (
    <div className="bg-[#1a1a1a] rounded-3xl p-6 shadow-xl">
      {/* Pool Name */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
          <Coins className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <p className="text-white/60 text-xs">Staking in</p>
          <p className="text-white font-semibold">
            {currentPool?.name || `Pool #${accountStatus.nominationPool.pool}`}
          </p>
        </div>
      </div>

      {/* Staked Amount */}
      <div className="mb-6">
        <p className="text-white/60 text-sm mb-1">Your Stake</p>
        <p className="text-white text-3xl font-bold">
          {formatStakingAmount(stakedAmount)}{" "}
          <span className="text-lg font-normal text-white/60">DOT</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Pending Rewards */}
        <button
          onClick={onClaimRewards}
          disabled={pendingRewards === 0}
          className="bg-white/10 rounded-2xl p-4 text-left hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span className="text-white/60 text-xs">Rewards</span>
          </div>
          <p className="text-white font-semibold">{formatStakingAmount(pendingRewards)} DOT</p>
          {pendingRewards > 0 && <p className="text-emerald-400 text-xs mt-1">Tap to claim</p>}
        </button>

        {/* Unbonding */}
        <div className="bg-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-white/60 text-xs">Unbonding</span>
          </div>
          <p className="text-white font-semibold">
            {hasUnlocks ? `${formatStakingAmount(totalUnlocking)} DOT` : "—"}
          </p>
          {totalReadyToWithdraw > 0 && (
            <button onClick={onWithdraw} className="text-amber-400 text-xs mt-1 hover:underline">
              Withdraw {formatStakingAmount(totalReadyToWithdraw)} DOT
            </button>
          )}
        </div>
      </div>

      {/* Unlock Schedule */}
      {hasUnlocks && (
        <div className="bg-white/5 rounded-xl p-3 mb-4">
          <p className="text-white/60 text-xs mb-2">Unlock Schedule</p>
          <div className="space-y-2">
            {unlocks.map((unlock: StakingUnlock, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-white/80">
                  {formatStakingAmount(planckToDot(unlock.value))} DOT
                </span>
                <span className="text-white/60">{formatUnlockTime(currentEra, unlock.era)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onStakeMore}
          className="flex-1 bg-violet-500 hover:bg-violet-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Stake More
        </button>
        <button
          onClick={onUnbond}
          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Unbond
        </button>
      </div>
    </div>
  );
}
