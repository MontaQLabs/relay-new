"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { checkEnoughFees, FeeEstimate } from "@/app/utils/crypto";
import { getWalletAddress } from "@/app/utils/wallet";
import type { Coin, KnownAsset } from "@/app/types/frontend_type";

interface UseFeeEstimateParams {
  recipientAddress: string | null;
  selectedToken: Coin | null;
  amount: string;
  coins: Coin[];
  knownAssets: KnownAsset[];
  isUsdMode?: boolean;
  getTokenPrice?: (ticker: string) => number;
  debounceMs?: number;
}

interface UseFeeEstimateReturn {
  feeEstimate: FeeEstimate | null;
  feeError: string | null;
  isCheckingFees: boolean;
  resetFees: () => void;
}

/**
 * Hook for estimating transaction fees with debouncing
 * Checks if user has enough balance to cover fees
 */
export function useFeeEstimate({
  recipientAddress,
  selectedToken,
  amount,
  coins,
  knownAssets,
  isUsdMode = false,
  getTokenPrice,
  debounceMs = 500,
}: UseFeeEstimateParams): UseFeeEstimateReturn {
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [isCheckingFees, setIsCheckingFees] = useState(false);
  const feeCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetFees = useCallback(() => {
    setFeeEstimate(null);
    setFeeError(null);
    setIsCheckingFees(false);
    if (feeCheckTimeoutRef.current) {
      clearTimeout(feeCheckTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    // Clear previous timeout
    if (feeCheckTimeoutRef.current) {
      clearTimeout(feeCheckTimeoutRef.current);
    }

    // Reset fee state when inputs change
    setFeeEstimate(null);
    setFeeError(null);

    // Validate inputs
    if (!recipientAddress || !selectedToken) {
      return;
    }

    const numericAmount = parseFloat(amount) || 0;

    // Calculate crypto amount based on mode
    let cryptoAmount: number;
    if (isUsdMode && getTokenPrice) {
      const price = getTokenPrice(selectedToken.ticker);
      cryptoAmount = price > 0 ? numericAmount / price : 0;
    } else {
      cryptoAmount = numericAmount;
    }

    if (cryptoAmount <= 0 || cryptoAmount > selectedToken.amount) {
      return;
    }

    const walletAddress = getWalletAddress();
    if (!walletAddress) return;

    // Get DOT balance for fee payment
    const dotCoin = coins.find((c) => c.ticker === "DOT");
    const dotBalance = dotCoin?.amount || 0;

    // Debounce the fee check
    feeCheckTimeoutRef.current = setTimeout(async () => {
      setIsCheckingFees(true);
      try {
        const result = await checkEnoughFees(
          walletAddress,
          recipientAddress,
          selectedToken.ticker,
          cryptoAmount,
          selectedToken.amount,
          dotBalance,
          knownAssets
        );

        setFeeEstimate(result.feeEstimate);
        if (!result.hasEnoughFees) {
          setFeeError(result.error || "Insufficient DOT for transaction fees");
        }
      } catch (error) {
        console.error("Fee check failed:", error);
        setFeeError("Failed to estimate fees");
      } finally {
        setIsCheckingFees(false);
      }
    }, debounceMs);

    return () => {
      if (feeCheckTimeoutRef.current) {
        clearTimeout(feeCheckTimeoutRef.current);
      }
    };
  }, [
    amount,
    recipientAddress,
    selectedToken,
    isUsdMode,
    coins,
    knownAssets,
    getTokenPrice,
    debounceMs,
  ]);

  return {
    feeEstimate,
    feeError,
    isCheckingFees,
    resetFees,
  };
}
