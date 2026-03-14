"use client";

import { useState, useEffect } from "react";
import { Users, Percent, Coins, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  formatCommission,
  formatMemberCount,
  formatPoolBond,
  formatStakingAmount,
} from "@/lib/format";
import { planckToDot, estimateJoinPoolFee } from "@/app/utils/staking";
import type { PoolDetails } from "@/app/types/frontend_type";

interface PoolDetailSheetProps {
  poolDetails: PoolDetails | null;
  isOpen: boolean;
  isLoadingDetails: boolean;
  onClose: () => void;
  onJoin: (poolId: number, amount: number) => Promise<void>;
  spendableBalance: number;
  isSubmitting?: boolean;
}

export function PoolDetailSheet({
  poolDetails,
  isOpen,
  isLoadingDetails,
  onClose,
  onJoin,
  spendableBalance,
  isSubmitting = false,
}: PoolDetailSheetProps) {
  const [amount, setAmount] = useState("");
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  const [isEstimatingFee, setIsEstimatingFee] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setEstimatedFee(null);
      setError(null);
    }
  }, [isOpen]);

  // Estimate fee when amount changes
  useEffect(() => {
    const estimateFee = async () => {
      if (!poolDetails || !amount || parseFloat(amount) <= 0) {
        setEstimatedFee(null);
        return;
      }

      setIsEstimatingFee(true);
      try {
        const feeResult = await estimateJoinPoolFee(poolDetails.id, parseFloat(amount));
        setEstimatedFee(feeResult.feeFormatted);
      } catch (err) {
        console.error("Failed to estimate fee:", err);
        setEstimatedFee(null);
      } finally {
        setIsEstimatingFee(false);
      }
    };

    const debounce = setTimeout(estimateFee, 500);
    return () => clearTimeout(debounce);
  }, [amount, poolDetails]);

  const handleAmountChange = (value: string) => {
    // Only allow numbers and one decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const handleMaxClick = () => {
    // Leave some for fees (0.1 DOT buffer)
    const maxAmount = Math.max(0, spendableBalance - 0.1);
    setAmount(maxAmount.toFixed(4));
  };

  const handleJoin = async () => {
    if (!poolDetails) return;

    const amountNum = parseFloat(amount);

    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (amountNum > spendableBalance) {
      setError("Insufficient balance");
      return;
    }

    // Minimum stake is typically 1 DOT
    if (amountNum < 1) {
      setError("Minimum stake is 1 DOT");
      return;
    }

    try {
      await onJoin(poolDetails.id, amountNum);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  const bondInDot = poolDetails ? planckToDot(poolDetails.bond) : 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="px-5 pb-8 max-h-[85vh] overflow-auto">
        {/* Loading State */}
        {isLoadingDetails && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading pool details...</p>
          </div>
        )}

        {/* Pool Details */}
        {!isLoadingDetails && poolDetails && (
          <>
            {/* Pool Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center">
                <span className="text-violet-600 font-bold text-lg">#{poolDetails.id}</span>
              </div>
              <div>
                <SheetTitle className="text-xl font-bold text-black">{poolDetails.name}</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Nomination Pool
                </SheetDescription>
              </div>
            </div>

            {/* Pool Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <Users className="w-5 h-5 text-violet-500 mx-auto mb-1" />
                <p className="text-lg font-semibold text-black">
                  {formatMemberCount(poolDetails.memberCount)}
                </p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <Percent className="w-5 h-5 text-violet-500 mx-auto mb-1" />
                <p className="text-lg font-semibold text-black">
                  {formatCommission(poolDetails.commission)}
                </p>
                <p className="text-xs text-muted-foreground">Commission</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <Coins className="w-5 h-5 text-violet-500 mx-auto mb-1" />
                <p className="text-lg font-semibold text-black">{formatPoolBond(bondInDot)}</p>
                <p className="text-xs text-muted-foreground">Total Staked</p>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-black">Stake Amount</label>
                <button
                  onClick={handleMaxClick}
                  className="text-sm text-violet-500 font-medium hover:text-violet-600"
                >
                  Max: {formatStakingAmount(spendableBalance)} DOT
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-gray-100 border-0 rounded-xl text-lg font-semibold text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  DOT
                </span>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            {/* Fee Estimate */}
            {(estimatedFee || isEstimatingFee) && (
              <div className="bg-gray-50 rounded-xl p-3 mb-6 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estimated Fee</span>
                <span className="text-sm font-medium text-black">
                  {isEstimatingFee ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    `${estimatedFee} DOT`
                  )}
                </span>
              </div>
            )}

            {/* Join Button */}
            <button
              onClick={handleJoin}
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              className="w-full bg-violet-500 hover:bg-violet-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining Pool...
                </>
              ) : (
                "Join Pool"
              )}
            </button>

            {/* Info Text */}
            <p className="text-xs text-muted-foreground text-center mt-4">
              Your stake will start earning rewards after joining. Unbonding takes approximately 28
              days.
            </p>
          </>
        )}

        {/* Error State */}
        {!isLoadingDetails && !poolDetails && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Failed to load pool details</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
