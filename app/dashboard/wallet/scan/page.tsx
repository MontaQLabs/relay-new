"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X, Flashlight, SwitchCamera, Loader2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { QRScanner, parseQRCodeAddress, isValidAddress } from "@/app/utils/qr";
import { fetchDotCoins, calculatePortfolioValue, checkEnoughFees, FeeEstimate } from "@/app/utils/crypto";
import { getKnownAssets } from "@/app/db/supabase";
import { getWalletAddress } from "@/app/utils/wallet";
import type { Coin, KnownAsset } from "@/app/types/frontend_type";

// Color mapping for common crypto tickers
const COIN_COLORS: Record<string, { bg: string; color: string }> = {
  ETH: { bg: "#627eea", color: "#ffffff" },
  ETC: { bg: "#3ab83a", color: "#ffffff" },
  ZEC: { bg: "#f4b728", color: "#1a1a1a" },
  XMR: { bg: "#ff6600", color: "#ffffff" },
  BTC: { bg: "#f7931a", color: "#ffffff" },
  USDT: { bg: "#26a17b", color: "#ffffff" },
  USDt: { bg: "#26a17b", color: "#ffffff" },
  USDC: { bg: "#2775ca", color: "#ffffff" },
  DOT: { bg: "#e6007a", color: "#ffffff" },
  SOL: { bg: "#9945ff", color: "#ffffff" },
  DEFAULT: { bg: "#6366f1", color: "#ffffff" },
};

export default function ScanPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedAddress, setScannedAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  
  // Token selection state
  const [coins, setCoins] = useState<Coin[]>([]);
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);
  const [isCoinsLoading, setIsCoinsLoading] = useState(false);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [knownAssets, setKnownAssets] = useState<KnownAsset[]>([]);
  
  // Fee checking state
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [isCheckingFees, setIsCheckingFees] = useState(false);

  const scannerRef = useRef<QRScanner | null>(null);
  const hasScannedRef = useRef(false);
  const coinsLoadedRef = useRef(false);
  const feeCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch coins when sheet opens (only once)
  useEffect(() => {
    if (isSheetOpen && !coinsLoadedRef.current) {
      const fetchCoinsAndPrices = async () => {
        setIsCoinsLoading(true);
        try {
          // Fetch known assets from Supabase
          const assets = await getKnownAssets();
          setKnownAssets(assets);
          
          // Fetch coins using known assets
          const fetchedCoins = await fetchDotCoins(assets);
          
          if (fetchedCoins.length > 0) {
            setIsPriceLoading(true);
            try {
              // Fetch real-time prices
              const { coinsWithPrices } = await calculatePortfolioValue(fetchedCoins);
              setCoins(coinsWithPrices);
              
              // Auto-select first coin with balance, or DOT as default
              const dotCoin = coinsWithPrices.find(c => c.ticker === "DOT");
              const firstWithBalance = coinsWithPrices.find(c => c.amount > 0);
              setSelectedToken(firstWithBalance || dotCoin || coinsWithPrices[0]);
            } catch (priceError) {
              console.error("Failed to fetch prices:", priceError);
              setCoins(fetchedCoins);
              const dotCoin = fetchedCoins.find(c => c.ticker === "DOT");
              setSelectedToken(dotCoin || fetchedCoins[0]);
            } finally {
              setIsPriceLoading(false);
            }
          }
          
          coinsLoadedRef.current = true;
        } catch (error) {
          console.error("Failed to fetch coins:", error);
        } finally {
          setIsCoinsLoading(false);
        }
      };
      fetchCoinsAndPrices();
    }
  }, [isSheetOpen]);

  // Check fees when amount changes (debounced)
  useEffect(() => {
    // Clear previous timeout
    if (feeCheckTimeoutRef.current) {
      clearTimeout(feeCheckTimeoutRef.current);
    }

    // Reset fee state when inputs change
    setFeeEstimate(null);
    setFeeError(null);

    // Only check fees if we have valid inputs
    const numAmount = parseFloat(amount) || 0;
    if (!scannedAddress || !selectedToken || numAmount <= 0 || numAmount > selectedToken.amount) {
      return;
    }

    const walletAddress = getWalletAddress();
    if (!walletAddress) return;

    // Get DOT balance for fee payment
    const dotCoin = coins.find(c => c.ticker === "DOT");
    const dotBalance = dotCoin?.amount || 0;

    // Debounce the fee check
    feeCheckTimeoutRef.current = setTimeout(async () => {
      setIsCheckingFees(true);
      try {
        const result = await checkEnoughFees(
          walletAddress,
          scannedAddress,
          selectedToken.ticker,
          numAmount,
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
    }, 500); // 500ms debounce

    return () => {
      if (feeCheckTimeoutRef.current) {
        clearTimeout(feeCheckTimeoutRef.current);
      }
    };
  }, [amount, scannedAddress, selectedToken, coins, knownAssets]);

  // Start or restart the scanner
  const startScanner = useCallback(async () => {
    try {
      // Clean up existing scanner if any
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }

      scannerRef.current = new QRScanner("qr-reader");

      await scannerRef.current.start(
        (result) => {
          // Prevent multiple scans
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;

          const address = parseQRCodeAddress(result);
          setScannedAddress(address);
          setIsSheetOpen(true);

          // Stop scanner and camera after successful scan
          if (scannerRef.current) {
            scannerRef.current.stop().catch((err) => {
              console.error("Error stopping scanner:", err);
            });
          }
        },
        (error) => {
          // Don't log errors after a successful scan
          if (hasScannedRef.current) return;

          // Only log significant errors (not the continuous "No QR code found" messages)
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

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop();
      }
    };
  }, [startScanner]);

  const handleBack = useCallback(() => {
    setIsExiting(true);
    if (scannerRef.current) {
      scannerRef.current.stop();
    }
    setTimeout(() => {
      router.back();
    }, 300);
  }, [router]);

  const handleSheetClose = useCallback(() => {
    setIsSheetOpen(false);
    setScannedAddress(null);
    setAmount("");
    setAmountUsd("");
    setShowTokenPicker(false);
    setFeeEstimate(null);
    setFeeError(null);
    hasScannedRef.current = false;

    // Restart scanner since we stopped it after successful scan
    startScanner();
  }, [startScanner]);

  const handleTokenSelect = (coin: Coin) => {
    setSelectedToken(coin);
    setAmount(""); // Reset amount when token changes
    setAmountUsd("");
    setShowTokenPicker(false);
    setFeeEstimate(null);
    setFeeError(null);
  };

  // Get token price from selected coin
  const getTokenPrice = useCallback((): number => {
    if (!selectedToken) return 0;
    if (selectedToken.amount > 0 && selectedToken.fiatValue > 0) {
      return selectedToken.fiatValue / selectedToken.amount;
    }
    // Default for stablecoins
    if (selectedToken.ticker === "USDT" || selectedToken.ticker === "USDt" || selectedToken.ticker === "USDC") {
      return 1;
    }
    return 0;
  }, [selectedToken]);

  const handleCancel = useCallback(async () => {
    // 1. Stop the QR scanner completely
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }

    // 2. Stop the camera by finding video elements and stopping their streams
    const videoElements = document.querySelectorAll("video");
    videoElements.forEach((video) => {
      const stream = video.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        video.srcObject = null;
      }
    });

    // 3. Close the sheet
    setIsSheetOpen(false);

    // 4. Navigate back to the wallet page
    router.push("/dashboard/wallet");
  }, [router]);

  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, "");
    setAmount(sanitized);

    // Calculate USD value
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

    // Stop scanner before navigating
    if (scannerRef.current) {
      scannerRef.current.stop();
    }

    // Navigate to payment review with params including fee
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
  
  // Check if entered amount exceeds available balance
  const isAmountExceedingBalance = useCallback(() => {
    if (!selectedToken || !amount) return false;
    const numericAmount = parseFloat(amount) || 0;
    if (numericAmount <= 0) return false;
    return numericAmount > selectedToken.amount;
  }, [amount, selectedToken]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black flex flex-col ${
        isExiting ? "animate-slide-out-right" : "animate-slide-in-right"
      }`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 relative z-10">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold text-white">
          Scan QR Code
        </h1>
        <div className="w-10" />
      </header>

      {/* Scanner View */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Scanner Container */}
        <div className="relative w-full max-w-[300px] aspect-square">
          {/* Scanner Element */}
          <div
            id="qr-reader"
            className="w-full h-full rounded-3xl overflow-hidden bg-gray-900"
          />

          {/* Overlay Frame */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner Decorations */}
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
          Position the QR code within the frame to scan the recipient&apos;s wallet
          address
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
            <SheetDescription>
              Enter the amount to send to this address
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Scanned Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Recipient Address
              </label>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p
                  className={`text-sm font-mono break-all ${
                    addressValid ? "text-emerald-600" : "text-gray-600"
                  }`}
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
              <label className="text-sm font-medium text-gray-700">
                Select Token
              </label>
              {isCoinsLoading ? (
                <div className="flex items-center justify-center py-4 bg-gray-50 rounded-xl">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading tokens...</span>
                </div>
              ) : showTokenPicker ? (
                <div className="bg-gray-50 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {coins.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No tokens available
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {coins.map((coin) => {
                        const coinColors = COIN_COLORS[coin.ticker] || COIN_COLORS.DEFAULT;
                        const isSelected = selectedToken?.ticker === coin.ticker;
                        
                        return (
                          <button
                            key={coin.ticker}
                            onClick={() => handleTokenSelect(coin)}
                            className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                              isSelected ? "bg-violet-50" : "hover:bg-gray-100"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: coinColors.bg }}
                              >
                                <span className="text-xs font-bold" style={{ color: coinColors.color }}>
                                  {coin.ticker[0]}
                                </span>
                              </div>
                              <span className="font-semibold text-black">{coin.ticker}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-sm font-medium text-black">{coin.amount.toFixed(4)}</div>
                                <div className="text-xs text-gray-500">${coin.fiatValue.toFixed(2)}</div>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowTokenPicker(true)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  {selectedToken ? (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: (COIN_COLORS[selectedToken.ticker] || COIN_COLORS.DEFAULT).bg }}
                      >
                        <span className="text-xs font-bold" style={{ color: (COIN_COLORS[selectedToken.ticker] || COIN_COLORS.DEFAULT).color }}>
                          {selectedToken.ticker[0]}
                        </span>
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-black">{selectedToken.ticker}</div>
                        <div className="text-xs text-gray-500">
                          Balance: {selectedToken.amount.toFixed(4)} (${selectedToken.fiatValue.toFixed(2)})
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">Select a token</span>
                  )}
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </button>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Amount ({selectedToken?.ticker || "Token"})
              </label>
              <div className={`relative rounded-xl transition-all ${
                isAmountExceedingBalance() 
                  ? "ring-2 ring-red-300 bg-red-50" 
                  : ""
              }`}>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={!selectedToken || selectedToken.amount === 0}
                  className={`h-14 text-2xl text-gray-500 font-semibold pr-16 rounded-xl border-gray-200 focus:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isAmountExceedingBalance() 
                      ? "text-red-500 border-red-300 bg-transparent" 
                      : ""
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className={`font-medium ${isAmountExceedingBalance() ? "text-red-500" : "text-gray-500"}`}>
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
                  <p className="text-sm text-amber-700 font-medium">
                    Insufficient balance
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    You don&apos;t have any {selectedToken.ticker} tokens to send.
                  </p>
                </div>
              )}
              
              {/* Exceeds Balance Warning */}
              {isAmountExceedingBalance() && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 font-medium">
                    Amount exceeds balance
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    You only have {selectedToken?.amount} {selectedToken?.ticker} (${selectedToken?.fiatValue.toFixed(2)}) available.
                  </p>
                </div>
              )}
              
              {/* Insufficient Fees Warning */}
              {!isAmountExceedingBalance() && feeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 font-medium">
                    Insufficient DOT for fees
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {feeError}
                  </p>
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
                disabled={!selectedToken || !isValidAmount || isCoinsLoading || isPriceLoading || isAmountExceedingBalance() || isCheckingFees || !feeEstimate || !!feeError}
                className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base"
              >
                {isCoinsLoading || isPriceLoading ? "Loading..." : isCheckingFees ? "Checking fees..." : "Continue to Review"}
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
    </div>
  );
}
