"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatStakingAmount } from "@/lib/format";

type ActionType = "stake" | "unbond";

interface StakeActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: ActionType;
  onConfirm: (amount: number) => Promise<void>;
  maxAmount: number; // Either spendable balance (for stake) or current bond (for unbond)
  isSubmitting?: boolean;
}

export function StakeActionSheet({
  isOpen,
  onClose,
  actionType,
  onConfirm,
  maxAmount,
  isSubmitting = false,
}: StakeActionSheetProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Handle sheet open/close - reset state when opening
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        // Reset state when sheet opens
        setAmount("");
        setError(null);
      } else {
        onClose();
      }
    },
    [onClose]
  );

  const handleAmountChange = (value: string) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const handleMaxClick = () => {
    if (actionType === "stake") {
      // Leave some for fees
      const maxStake = Math.max(0, maxAmount - 0.1);
      setAmount(maxStake.toFixed(4));
    } else {
      // For unbond, can unbond full amount
      setAmount(maxAmount.toFixed(4));
    }
  };

  const handleConfirm = async () => {
    const amountNum = parseFloat(amount);

    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (amountNum > maxAmount) {
      setError(actionType === "stake" ? "Insufficient balance" : "Amount exceeds staked balance");
      return;
    }

    if (actionType === "stake" && amountNum < 1) {
      setError("Minimum stake is 1 DOT");
      return;
    }

    try {
      await onConfirm(amountNum);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  const title = actionType === "stake" ? "Stake More DOT" : "Unbond DOT";
  const description =
    actionType === "stake"
      ? "Add more DOT to your stake"
      : "Remove DOT from your stake (28-day unbonding period)";
  const buttonText = actionType === "stake" ? "Stake" : "Unbond";
  const maxLabel = actionType === "stake" ? "Available" : "Staked";

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="px-5 pb-8">
        <SheetTitle className="text-xl font-bold text-black mb-1">{title}</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground mb-6">
          {description}
        </SheetDescription>

        {/* Amount Input */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-black">Amount</label>
            <button
              onClick={handleMaxClick}
              className="text-sm text-violet-500 font-medium hover:text-violet-600"
            >
              {maxLabel}: {formatStakingAmount(maxAmount)} DOT
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

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
          className={`w-full font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 ${
            actionType === "unbond"
              ? "bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300"
              : "bg-violet-500 hover:bg-violet-600 disabled:bg-gray-300"
          } disabled:cursor-not-allowed text-white`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            buttonText
          )}
        </button>

        {/* Warning for unbond */}
        {actionType === "unbond" && (
          <p className="text-xs text-amber-600 text-center mt-4 bg-amber-50 p-3 rounded-xl">
            Unbonding takes approximately 28 days. During this period, your tokens will not earn
            rewards and cannot be transferred.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
