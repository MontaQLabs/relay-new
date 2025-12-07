"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estimateTransferFee, FeeEstimate, sendTransfer, TransferResult } from "@/app/utils/crypto";
import { WALLET_KEY } from "@/app/types/constants";
import { getKnownAssets } from "@/app/db/supabase";
import type { Wallet, KnownAsset } from "@/app/types/frontend_type";

// Transaction states for the confirm button
type TransactionState = "idle" | "processing" | "success" | "error";

// Color mapping for common crypto tickers
const COIN_COLORS: Record<string, { bg: string; iconBg: string }> = {
  ETH: { bg: "#627eea", iconBg: "#e8f5e9" },
  ETC: { bg: "#3ab83a", iconBg: "#e8f5e9" },
  ZEC: { bg: "#f4b728", iconBg: "#fff8e1" },
  XMR: { bg: "#ff6600", iconBg: "#fff3e0" },
  BTC: { bg: "#f7931a", iconBg: "#fff8e1" },
  USDT: { bg: "#26a17b", iconBg: "#e8f5e9" },
  USDC: { bg: "#2775ca", iconBg: "#e3f2fd" },
  DOT: { bg: "#e6007a", iconBg: "#fce4ec" },
  SOL: { bg: "#9945ff", iconBg: "#f3e5f5" },
  DEFAULT: { bg: "#6366f1", iconBg: "#ede7f6" },
};

function PaymentReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExiting, setIsExiting] = useState(false);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [feeLoading, setFeeLoading] = useState(true);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TransactionState>("idle");
  const [txError, setTxError] = useState<string | null>(null);
  const [knownAssets, setKnownAssets] = useState<KnownAsset[]>([]);

  // Get payment data from search params
  const address = searchParams.get("address") || "";
  const token = searchParams.get("token") || "";
  const amountUsd = parseFloat(searchParams.get("amountUsd") || "0");
  const amountCrypto = parseFloat(searchParams.get("amountCrypto") || "0");

  // Fetch known assets and transaction fee estimate on mount
  useEffect(() => {
    const fetchAssetsAndFee = async () => {
      if (!address || !token || !amountCrypto) {
        setFeeLoading(false);
        return;
      }

      try {
        // First, fetch known assets from Supabase
        const assets = await getKnownAssets();
        setKnownAssets(assets);

        // Get sender address from localStorage
        const walletData = localStorage.getItem(WALLET_KEY);
        if (!walletData) {
          setFeeError("Wallet not found");
          setFeeLoading(false);
          return;
        }

        const wallet: Wallet = JSON.parse(walletData);
        const senderAddress = wallet.address;

        if (!senderAddress) {
          setFeeError("No sender address");
          setFeeLoading(false);
          return;
        }

        const estimate = await estimateTransferFee(
          senderAddress,
          address,
          token,
          amountCrypto,
          assets
        );
        setFeeEstimate(estimate);
        setFeeError(null);
      } catch (error) {
        console.error("Failed to estimate fee:", error);
        setFeeError("Unable to estimate fee");
      } finally {
        setFeeLoading(false);
      }
    };

    fetchAssetsAndFee();
  }, [address, token, amountCrypto]);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleCancel = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.push("/dashboard/wallet");
    }, 300);
  };

  const handleConfirm = async () => {
    if (txState === "processing" || txState === "success") return;
    
    setTxState("processing");
    setTxError(null);

    try {
      const result: TransferResult = await sendTransfer(
        address,
        token,
        "Polkadot Asset Hub", // network
        amountCrypto,
        knownAssets
      );

      if (result.success) {
        setTxState("success");
        // Navigate back to wallet after a short delay to show success state
        setTimeout(() => {
          router.push("/dashboard/wallet");
        }, 2000);
      } else {
        setTxState("error");
        setTxError(result.error || "Transaction failed");
      }
    } catch (error) {
      setTxState("error");
      setTxError(error instanceof Error ? error.message : "Transaction failed");
    }
  };

  const coinColors = COIN_COLORS[token] || COIN_COLORS.DEFAULT;

  const formatUsd = (value: number) => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-white flex flex-col ${
        isExiting ? "animate-slide-out-right" : "animate-slide-in-right"
      }`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 relative">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold text-black">
          Review
        </h1>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-8 overflow-auto">
        {/* Coin Icon and Amount */}
        <div className="flex flex-col items-center mb-8 animate-slide-up">
          {/* Coin Icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6 relative"
            style={{ backgroundColor: coinColors.iconBg }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: coinColors.bg }}
            >
              <CryptoIcon symbol={token} color="#ffffff" size={32} />
            </div>
            {/* Small coin badge */}
            <div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white"
              style={{ backgroundColor: coinColors.iconBg }}
            >
              <CryptoIcon symbol={token} color={coinColors.bg} size={14} />
            </div>
          </div>

          {/* Amount in USD */}
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-black">
              {formatUsd(amountUsd)}
            </span>
            <span className="text-xl text-muted-foreground font-medium">
              USD
            </span>
          </div>

          {/* Amount in Crypto */}
          <div className="text-lg text-muted-foreground mt-2">
            ≈ {amountCrypto} {token}
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-0 divide-y divide-gray-100">
          {/* Receiver Name */}
          <div className="py-4 animate-slide-up animation-delay-100">
            <div className="text-sm text-muted-foreground mb-1">
              Receiver Name
            </div>
            <div className="text-base text-muted-foreground truncate">
              {address}
            </div>
          </div>

          {/* Receiver Address */}
          <div className="py-4 animate-slide-up animation-delay-200">
            <div className="text-sm text-muted-foreground mb-1">
              Receiver Address
            </div>
            <div className="text-base text-emerald-600 break-all">
              {address}
            </div>
          </div>

          {/* Network */}
          <div className="py-4 animate-slide-up animation-delay-300">
            <div className="text-sm text-muted-foreground mb-1">Network</div>
            <div className="text-base text-muted-foreground">{token}</div>
          </div>

          {/* Transaction Fee */}
          <div className="py-4 animate-slide-up animation-delay-400">
            <div className="text-sm text-muted-foreground mb-1">
              Transaction Fee
            </div>
            <div className="text-base text-muted-foreground">
              {feeLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                  <span>Estimating...</span>
                </div>
              ) : feeError ? (
                <span className="text-red-500">{feeError}</span>
              ) : feeEstimate ? (
                <span>
                  {feeEstimate.feeFormatted} {feeEstimate.feeTicker}
                </span>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="px-5 pb-8 pt-4 space-y-3">
        {/* Error message */}
        {txState === "error" && txError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center mb-2">
            {txError}
          </div>
        )}
        
        <Button
          onClick={handleConfirm}
          disabled={txState === "processing" || txState === "success"}
          className={`w-full h-14 rounded-2xl font-semibold text-base transition-all ${
            txState === "success"
              ? "bg-emerald-500 hover:bg-emerald-500 text-white"
              : txState === "error"
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white"
          }`}
        >
          {txState === "processing" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processing...
            </>
          ) : txState === "success" ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Success!
            </>
          ) : txState === "error" ? (
            <>
              <X className="w-5 h-5 mr-2" />
              Failed - Tap to Retry
            </>
          ) : (
            "Confirm"
          )}
        </Button>
        <Button
          onClick={handleCancel}
          variant="outline"
          disabled={txState === "processing"}
          className="w-full h-14 rounded-2xl border-gray-200 bg-gray-50 hover:bg-gray-100 text-black font-semibold text-base transition-all disabled:opacity-50"
        >
          {txState === "success" ? "Done" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

// Crypto Icon Component
function CryptoIcon({
  symbol,
  color,
  size = 24,
}: {
  symbol: string;
  color: string;
  size?: number;
}) {
  switch (symbol) {
    case "ETH":
    case "ETC":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="none"
          style={{ color }}
        >
          <path
            d="M10 2L4 10L10 13L16 10L10 2Z"
            fill="currentColor"
            opacity={symbol === "ETH" ? 0.6 : 0.8}
          />
          <path d="M10 13L4 10L10 18L16 10L10 13Z" fill="currentColor" />
        </svg>
      );
    case "BTC":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="none"
          style={{ color }}
        >
          <text
            x="50%"
            y="55%"
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="currentColor"
          >
            ₿
          </text>
        </svg>
      );
    case "ZEC":
      return (
        <span style={{ color, fontSize: size * 0.7, fontWeight: "bold" }}>
          ⓩ
        </span>
      );
    case "XMR":
      return (
        <span style={{ color, fontSize: size * 0.7, fontWeight: "bold" }}>
          ɱ
        </span>
      );
    default:
      return (
        <span style={{ color, fontSize: size * 0.6, fontWeight: "bold" }}>
          {symbol[0]}
        </span>
      );
  }
}

export default function PaymentReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      }
    >
      <PaymentReviewContent />
    </Suspense>
  );
}
