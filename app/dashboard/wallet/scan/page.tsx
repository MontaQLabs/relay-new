"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Flashlight, SwitchCamera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { TokenPicker } from "@/components/crypto";
import { PageHeader } from "@/components/layout/PageHeader";
import { SlideInPage } from "@/components/layout/SlideInPage";
import { useSlideNavigation, useCoins, useFeeEstimate } from "@/hooks";
import { QRScanner, parseQRCodeAddress, isValidAddress } from "@/app/utils/qr";
import type { Coin } from "@/app/types/frontend_type";

export default function ScanPage() {
  const { isExiting, handleBack, router } = useSlideNavigation();
  const [scannerReady, setScannerReady] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedAddress, setScannedAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  // Use coins hook (don't auto-fetch until sheet opens)
  const {
    coins,
    knownAssets,
    isLoading: isCoinsLoading,
    isPriceLoading,
    selectedToken,
    setSelectedToken,
    refetch: fetchCoins,
  } = useCoins({ autoFetch: false });

  const coinsLoadedRef = useRef(false);
  const scannerRef = useRef<QRScanner | null>(null);
  const hasScannedRef = useRef(false);

  // Fetch coins when sheet opens
  useEffect(() => {
    if (isSheetOpen && !coinsLoadedRef.current) {
      fetchCoins();
      coinsLoadedRef.current = true;
    }
  }, [isSheetOpen, fetchCoins]);

  // Get token price
  const getTokenPrice = useCallback((): number => {
    if (!selectedToken) return 0;
    if (selectedToken.amount > 0 && selectedToken.fiatValue > 0) {
      return selectedToken.fiatValue / selectedToken.amount;
    }
    if (
      selectedToken.ticker === "USDT" ||
      selectedToken.ticker === "USDt" ||
      selectedToken.ticker === "USDC"
    ) {
      return 1;
    }
    return 0;
  }, [selectedToken]);

  // Use fee estimate hook
  const { feeEstimate, feeError, isCheckingFees, resetFees } = useFeeEstimate({
    recipientAddress: scannedAddress,
    selectedToken,
    amount,
    coins,
    knownAssets,
    isUsdMode: false,
  });

  // Start or restart the scanner
  const startScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }

      scannerRef.current = new QRScanner("qr-reader");

      await scannerRef.current.start(
        (result) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;

          const address = parseQRCodeAddress(result);
          setScannedAddress(address);
          setIsSheetOpen(true);

          if (scannerRef.current) {
            scannerRef.current.stop().catch((err) => {
              console.error("Error stopping scanner:", err);
            });
          }
        },
        (error) => {
          if (hasScannedRef.current) return;
          if (error && !error.includes("No QR code found")) {
            console.error("Scan error:", error);
          }
        }
      );

      setScannerReady(true);
      setScanError(null);
    } catch (error) {
      console.error("Failed to initialize scanner:", error);
      setScanError(
        error instanceof Error
          ? error.message
          : "Failed to access camera. Please grant camera permissions."
      );
    }
  }, []);

  // Initialize scanner on mount
  useEffect(() => {
    let mounted = true;

    const initScanner = async () => {
      if (mounted) {
        await startScanner();
      }
    };

    initScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop();
      }
    };
  }, [startScanner]);

  const handleSheetClose = useCallback(() => {
    setIsSheetOpen(false);
    setScannedAddress(null);
    setAmount("");
    setAmountUsd("");
    setShowTokenPicker(false);
    resetFees();
    hasScannedRef.current = false;
    startScanner();
  }, [startScanner, resetFees]);

  const handleTokenSelect = (coin: Coin) => {
    setSelectedToken(coin);
    setAmount("");
    setAmountUsd("");
    setShowTokenPicker(false);
    resetFees();
  };

  const handleCancel = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }

    const videoElements = document.querySelectorAll("video");
    videoElements.forEach((video) => {
      const stream = video.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    });

    setIsSheetOpen(false);
    router.push("/dashboard/wallet");
  }, [router]);

  const handleAmountChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    setAmount(sanitized);

    const numValue = parseFloat(sanitized) || 0;
    const price = getTokenPrice();
    const usdValue = numValue * price;
    setAmountUsd(usdValue.toFixed(2));
  };

  const handleConfirm = () => {
    if (!scannedAddress || !amount || !selectedToken || !feeEstimate) return;

    const numAmount = parseFloat(amount) || 0;
    const price = getTokenPrice();
    const usdAmount = numAmount * price;

    if (scannerRef.current) {
      scannerRef.current.stop();
    }

    const params = new URLSearchParams({
      address: scannedAddress,
      token: selectedToken.ticker,
      amountCrypto: numAmount.toString(),
      amountUsd: usdAmount.toFixed(2),
      fee: feeEstimate.feeFormatted,
      feeTicker: feeEstimate.feeTicker,
    });

    router.push(`/dashboard/wallet/payment-review?${params.toString()}`);
  };

  const isValidAmount = parseFloat(amount) > 0;
  const addressValid = scannedAddress ? isValidAddress(scannedAddress) : false;
  const tokenPrice = getTokenPrice();

  const isAmountExceedingBalance = useCallback(() => {
    if (!selectedToken || !amount) return false;
    const numericAmount = parseFloat(amount) || 0;
    if (numericAmount <= 0) return false;
    return numericAmount > selectedToken.amount;
  }, [amount, selectedToken]);

  return (
    <SlideInPage isExiting={isExiting} variant="dark">
      {/* Header */}
      <PageHeader title="Scan QR Code" onBack={handleBack} variant="dark" />

      {/* Scanner View */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Scanner Container */}
        <div className="relative w-full max-w-[300px] aspect-square">
          <div id="qr-reader" className="w-full h-full rounded-3xl overflow-hidden bg-gray-900" />

          {/* Overlay Frame */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-3xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-3xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-3xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-3xl" />
          </div>

          {/* Loading State */}
          {!scannerReady && !scanError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-3xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-white text-sm">Starting camera...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {scanError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-3xl p-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-white text-sm">{scanError}</span>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="mt-2 text-white border-white/30 hover:bg-white/10"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="text-white/70 text-center mt-8 text-sm max-w-[250px]">
          Position the QR code within the frame to scan the recipient&apos;s wallet address
        </p>

        {/* Quick Actions */}
        <div className="flex items-center gap-4 mt-8">
          <button
            className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Toggle flashlight"
          >
            <Flashlight className="w-6 h-6 text-white" />
          </button>
          <button
            className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Bottom Sheet for Scan Result */}
      <Sheet open={isSheetOpen} onOpenChange={() => {}}>
        <SheetContent side="bottom" hideCloseButton className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="text-xl text-black">Send Payment</SheetTitle>
            <SheetDescription>Enter the amount to send to this address</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Scanned Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Recipient Address</label>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p
                  className={`text-sm font-mono break-all ${addressValid ? "text-emerald-600" : "text-gray-600"}`}
                >
                  {scannedAddress}
                </p>
                {!addressValid && scannedAddress && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ This address format could not be verified
                  </p>
                )}
              </div>
            </div>

            {/* Token Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Select Token</label>
              <TokenPicker
                coins={coins}
                selectedToken={selectedToken}
                onSelect={handleTokenSelect}
                isLoading={isCoinsLoading}
                showPicker={showTokenPicker}
                onTogglePicker={() => setShowTokenPicker(!showTokenPicker)}
              />
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Amount ({selectedToken?.ticker || "Token"})
              </label>
              <div
                className={`relative rounded-xl transition-all ${
                  isAmountExceedingBalance() ? "ring-2 ring-red-300 bg-red-50" : ""
                }`}
              >
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={!selectedToken || selectedToken.amount === 0}
                  className={`h-14 text-2xl text-gray-500 font-semibold pr-16 rounded-xl border-gray-200 focus:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isAmountExceedingBalance() ? "text-red-500 border-red-300 bg-transparent" : ""
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span
                    className={`font-medium ${isAmountExceedingBalance() ? "text-red-500" : "text-gray-500"}`}
                  >
                    {selectedToken?.ticker || ""}
                  </span>
                </div>
              </div>

              {/* Price info and Max button */}
              {selectedToken && selectedToken.amount > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {amount && !isAmountExceedingBalance() ? (
                      isPriceLoading ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Fetching price...
                        </span>
                      ) : tokenPrice > 0 ? (
                        `≈ $${amountUsd} USD`
                      ) : (
                        "Price unavailable"
                      )
                    ) : (
                      <span className="text-gray-400">Enter amount</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setAmount(selectedToken.amount.toString());
                      const usdValue = selectedToken.amount * tokenPrice;
                      setAmountUsd(usdValue.toFixed(2));
                    }}
                    className="text-sm font-medium text-violet-500 hover:text-violet-600 transition-colors"
                  >
                    Max
                  </button>
                </div>
              )}

              {/* Zero Balance Warning */}
              {selectedToken && selectedToken.amount === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-700 font-medium">Insufficient balance</p>
                  <p className="text-xs text-amber-600 mt-1">
                    You don&apos;t have any {selectedToken.ticker} tokens to send.
                  </p>
                </div>
              )}

              {/* Exceeds Balance Warning */}
              {isAmountExceedingBalance() && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 font-medium">Amount exceeds balance</p>
                  <p className="text-xs text-red-600 mt-1">
                    You only have {selectedToken?.amount} {selectedToken?.ticker} ($
                    {selectedToken?.fiatValue.toFixed(2)}) available.
                  </p>
                </div>
              )}

              {/* Insufficient Fees Warning */}
              {!isAmountExceedingBalance() && feeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 font-medium">Insufficient DOT for fees</p>
                  <p className="text-xs text-red-600 mt-1">{feeError}</p>
                </div>
              )}

              {/* Fee Estimate Display */}
              {!isAmountExceedingBalance() && !feeError && feeEstimate && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
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
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Estimating fees...
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleConfirm}
                disabled={
                  !selectedToken ||
                  !isValidAmount ||
                  isCoinsLoading ||
                  isPriceLoading ||
                  isAmountExceedingBalance() ||
                  isCheckingFees ||
                  !feeEstimate ||
                  !!feeError
                }
                className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base"
              >
                {isCoinsLoading || isPriceLoading
                  ? "Loading..."
                  : isCheckingFees
                    ? "Checking fees..."
                    : "Continue to Review"}
              </Button>
              <Button
                onClick={handleSheetClose}
                variant="outline"
                className="w-full h-14 rounded-2xl border-gray-200 bg-gray-50 hover:bg-gray-100 text-black font-semibold text-base"
              >
                Scan Again
              </Button>
              <Button
                onClick={handleCancel}
                variant="ghost"
                className="w-full h-14 rounded-2xl text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold text-base"
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </SlideInPage>
  );
}
