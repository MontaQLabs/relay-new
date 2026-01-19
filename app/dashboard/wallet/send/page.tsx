"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TokenList } from "@/components/crypto";
import { PageHeader } from "@/components/layout/PageHeader";
import { SlideInPage } from "@/components/layout/SlideInPage";
import { useSlideNavigation, useCoins, useFeeEstimate } from "@/hooks";
import { isAddrValid } from "@/app/utils/wallet";
import type { Coin } from "@/app/types/frontend_type";

export default function SendPage() {
  const { isExiting, handleBack, router } = useSlideNavigation();

  // Form state
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isUsdMode, setIsUsdMode] = useState(true);

  // Use coins hook
  const {
    coins,
    knownAssets,
    isLoading,
    isPriceLoading,
    selectedToken,
    setSelectedToken,
  } = useCoins();

  // Get token price
  const getTokenPrice = useCallback(
    (ticker: string): number => {
      const coin = coins.find((c) => c.ticker === ticker);
      if (coin && coin.amount > 0 && coin.fiatValue > 0) {
        return coin.fiatValue / coin.amount;
      }
      if (ticker === "USDT" || ticker === "USDt" || ticker === "USDC") {
        return 1;
      }
      return 0;
    },
    [coins]
  );

  // Use fee estimate hook
  const { feeEstimate, feeError, isCheckingFees } = useFeeEstimate({
    recipientAddress: isAddrValid(address) ? address : null,
    selectedToken,
    amount,
    coins,
    knownAssets,
    isUsdMode,
    getTokenPrice,
  });

  const handlePasteOrClear = async () => {
    if (address) {
      setAddress("");
    } else {
      try {
        const text = await navigator.clipboard.readText();
        setAddress(text);
      } catch (error) {
        console.error("Failed to read clipboard:", error);
      }
    }
  };

  const handleTokenSelect = (coin: Coin) => {
    setSelectedToken(coin);
    setAmount("");
  };

  const handleAmountChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const toggleCurrencyMode = () => {
    if (!selectedToken || !amount) {
      setIsUsdMode(!isUsdMode);
      return;
    }

    const price = getTokenPrice(selectedToken.ticker);
    if (price === 0) {
      setIsUsdMode(!isUsdMode);
      return;
    }

    const numericAmount = parseFloat(amount) || 0;

    if (isUsdMode) {
      const cryptoAmount = numericAmount / price;
      setAmount(cryptoAmount.toFixed(8).replace(/\.?0+$/, ""));
    } else {
      const usdAmount = numericAmount * price;
      setAmount(usdAmount.toFixed(2));
    }
    setIsUsdMode(!isUsdMode);
  };

  const getConvertedAmount = useCallback(() => {
    if (!selectedToken || !amount) return "0";
    const price = getTokenPrice(selectedToken.ticker);
    if (price === 0) return "0";

    const numericAmount = parseFloat(amount) || 0;

    if (isUsdMode) {
      const cryptoAmount = numericAmount / price;
      return cryptoAmount.toFixed(6).replace(/\.?0+$/, "");
    } else {
      const usdAmount = numericAmount * price;
      return usdAmount.toFixed(2);
    }
  }, [selectedToken, amount, isUsdMode, getTokenPrice]);

  const isAmountExceedingBalance = useCallback(() => {
    if (!selectedToken || !amount || selectedToken.amount === 0) return false;

    const numericAmount = parseFloat(amount) || 0;
    if (numericAmount <= 0) return false;

    if (isUsdMode) {
      return numericAmount > selectedToken.fiatValue;
    } else {
      return numericAmount > selectedToken.amount;
    }
  }, [selectedToken, amount, isUsdMode]);

  const isFormValid = () => {
    const hasValidAddress = isAddrValid(address);
    const hasToken = selectedToken !== null;
    const hasAmount = amount !== "" && parseFloat(amount) > 0;
    const withinBalance = !isAmountExceedingBalance();
    const hasFeeEstimate = feeEstimate !== null && !feeError;
    const notCheckingFees = !isCheckingFees;
    return hasValidAddress && hasToken && hasAmount && withinBalance && hasFeeEstimate && notCheckingFees;
  };

  const handleConfirm = () => {
    if (isFormValid() && selectedToken && feeEstimate) {
      const price = getTokenPrice(selectedToken.ticker);
      const numericAmount = parseFloat(amount) || 0;

      let amountUsd: number;
      let amountCrypto: number;

      if (isUsdMode) {
        amountUsd = numericAmount;
        amountCrypto = price > 0 ? numericAmount / price : 0;
      } else {
        amountCrypto = numericAmount;
        amountUsd = numericAmount * price;
      }

      const params = new URLSearchParams({
        address,
        token: selectedToken.ticker,
        amountUsd: amountUsd.toFixed(2),
        amountCrypto: amountCrypto.toFixed(6).replace(/\.?0+$/, ""),
        fee: feeEstimate.feeFormatted,
        feeTicker: feeEstimate.feeTicker,
      });

      router.push(`/dashboard/wallet/payment-review?${params.toString()}`);
    }
  };

  return (
    <SlideInPage isExiting={isExiting}>
      <PageHeader title="Send" onBack={handleBack} />

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-4 gap-4 overflow-auto">
        {/* Step 1: Recipient Address */}
        <div className="animate-slide-up">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Recipient Address
          </label>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter or paste recipient's wallet address"
              className="min-h-[100px] bg-transparent border-none resize-none text-black placeholder:text-gray-400 text-base p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="border-t border-gray-200">
              <button
                onClick={handlePasteOrClear}
                className="w-full py-3 text-violet-500 font-medium text-base hover:bg-gray-100 transition-colors"
              >
                {address ? "Clear" : "Paste"}
              </button>
            </div>
          </div>
          {address && !isAddrValid(address) && (
            <p className="text-sm text-red-500 mt-2">Invalid address format</p>
          )}
        </div>

        {/* Step 2: Token Selection */}
        <div className="animate-slide-up animation-delay-100">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Select Token
          </label>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <TokenList
              coins={coins}
              selectedToken={selectedToken}
              onSelect={handleTokenSelect}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Step 3: Amount Input */}
        <div className="animate-slide-up animation-delay-200">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Amount
          </label>
          <div
            className={`rounded-2xl p-4 transition-all ${
              isAmountExceedingBalance()
                ? "bg-red-50 border-2 border-red-300"
                : "bg-gray-50"
            }`}
          >
            {/* Currency Toggle */}
            <div className="flex justify-end mb-2">
              <div className="inline-flex bg-gray-200 rounded-lg p-0.5">
                <button
                  onClick={() => !isUsdMode && toggleCurrencyMode()}
                  disabled={!selectedToken || selectedToken.amount === 0}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                    isUsdMode
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  USD
                </button>
                <button
                  onClick={() => isUsdMode && toggleCurrencyMode()}
                  disabled={!selectedToken || selectedToken.amount === 0}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                    !isUsdMode
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {selectedToken?.ticker || "Token"}
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className={`flex items-center gap-2 ${selectedToken?.amount === 0 ? "opacity-50" : ""}`}>
              <span className={`text-4xl font-bold ${isAmountExceedingBalance() ? "text-red-500" : "text-black"}`}>
                {isUsdMode ? "$" : ""}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className={`w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-gray-300 disabled:cursor-not-allowed ${
                  isAmountExceedingBalance() ? "text-red-500" : "text-black"
                }`}
                disabled={!selectedToken || selectedToken.amount === 0}
              />
            </div>

            {/* Equivalent Value Display */}
            {selectedToken && selectedToken.amount > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {amount && parseFloat(amount) > 0 ? (
                    isPriceLoading ? (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 border border-gray-300 border-t-violet-500 rounded-full animate-spin" />
                        <span>Loading...</span>
                      </span>
                    ) : (
                      <>
                        ≈{" "}
                        {isUsdMode ? (
                          <span>{getConvertedAmount()} {selectedToken.ticker}</span>
                        ) : (
                          <span>${getConvertedAmount()}</span>
                        )}
                      </>
                    )
                  ) : (
                    <span className="text-gray-400">
                      {isUsdMode ? `Enter USD amount` : `Enter ${selectedToken.ticker} amount`}
                    </span>
                  )}
                </div>

                {/* Max button */}
                <button
                  onClick={() => {
                    if (isUsdMode) {
                      setAmount(selectedToken.fiatValue.toFixed(2));
                    } else {
                      setAmount(selectedToken.amount.toString());
                    }
                  }}
                  className="text-sm font-medium text-violet-500 hover:text-violet-600 transition-colors"
                >
                  Max
                </button>
              </div>
            )}

            {/* Zero Balance Warning */}
            {selectedToken && selectedToken.amount === 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-700 font-medium">Insufficient balance</p>
                <p className="text-xs text-amber-600 mt-1">
                  You don&apos;t have any {selectedToken.ticker} tokens to send.
                </p>
              </div>
            )}

            {/* Exceeds Balance Warning */}
            {isAmountExceedingBalance() && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium">Amount exceeds balance</p>
                <p className="text-xs text-red-600 mt-1">
                  You only have {selectedToken?.amount} {selectedToken?.ticker} ($
                  {selectedToken?.fiatValue.toFixed(2)}) available.
                </p>
              </div>
            )}

            {/* Insufficient Fees Warning */}
            {!isAmountExceedingBalance() && feeError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium">Insufficient DOT for fees</p>
                <p className="text-xs text-red-600 mt-1">{feeError}</p>
              </div>
            )}

            {/* Fee Estimate Display */}
            {!isAmountExceedingBalance() && !feeError && feeEstimate && (
              <div className="mt-3 p-3 bg-gray-100 border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estimated Fee</span>
                  <span className="text-sm font-medium text-gray-900">
                    {feeEstimate.feeFormatted} {feeEstimate.feeTicker}
                  </span>
                </div>
              </div>
            )}

            {/* Fee Loading */}
            {!isAmountExceedingBalance() && isCheckingFees && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Estimating fees...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-5 pb-8 pt-4">
        <Button
          onClick={handleConfirm}
          disabled={!isFormValid()}
          className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isCheckingFees ? "Checking fees..." : "Confirm"}
        </Button>
      </div>
    </SlideInPage>
  );
}
