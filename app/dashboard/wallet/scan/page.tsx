"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X, Flashlight, SwitchCamera, Loader2 } from "lucide-react";
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
import { getTokenPrice } from "@/app/utils/crypto";

export default function ScanPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedAddress, setScannedAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedToken] = useState("DOT"); // Default token
  const [tokenPrice, setTokenPrice] = useState(0);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  const scannerRef = useRef<QRScanner | null>(null);
  const hasScannedRef = useRef(false);

  // Fetch real-time token price when sheet opens
  useEffect(() => {
    if (isSheetOpen && tokenPrice === 0) {
      const fetchPrice = async () => {
        setIsPriceLoading(true);
        try {
          const price = await getTokenPrice(selectedToken);
          setTokenPrice(price);
        } catch (error) {
          console.error("Failed to fetch token price:", error);
        } finally {
          setIsPriceLoading(false);
        }
      };
      fetchPrice();
    }
  }, [isSheetOpen, selectedToken, tokenPrice]);

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
    hasScannedRef.current = false;

    // Restart scanner since we stopped it after successful scan
    startScanner();
  }, [startScanner]);

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
    const usdValue = numValue * tokenPrice;
    setAmountUsd(usdValue.toFixed(2));
  };

  const handleConfirm = () => {
    if (!scannedAddress || !amount) return;

    const numAmount = parseFloat(amount) || 0;
    const usdAmount = numAmount * tokenPrice;

    // Stop scanner before navigating
    if (scannerRef.current) {
      scannerRef.current.stop();
    }

    // Navigate to payment review with params
    const params = new URLSearchParams({
      address: scannedAddress,
      token: selectedToken,
      amountCrypto: numAmount.toString(),
      amountUsd: usdAmount.toFixed(2),
    });

    router.push(`/dashboard/wallet/payment-review?${params.toString()}`);
  };

  const isValidAmount = parseFloat(amount) > 0;
  const addressValid = scannedAddress ? isValidAddress(scannedAddress) : false;

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

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Amount ({selectedToken})
              </label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="h-14 text-2xl font-semibold pr-16 rounded-xl border-gray-200 focus:border-gray-400"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-gray-500 font-medium">{selectedToken}</span>
                </div>
              </div>
              {amount && (
                <p className="text-sm text-gray-500">
                  {isPriceLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Fetching price...
                    </span>
                  ) : tokenPrice > 0 ? (
                    `≈ $${amountUsd} USD`
                  ) : (
                    "Price unavailable"
                  )}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleConfirm}
                disabled={!isValidAmount || isPriceLoading || tokenPrice === 0}
                className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base"
              >
                {isPriceLoading ? "Loading price..." : "Continue to Review"}
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
