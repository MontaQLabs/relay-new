"use client";

import { useState, useEffect } from "react";
import type { Coin } from "@/app/types/frontend_type";
import { fetchDotCoins } from "@/app/utils/crypto";
import { ActionButton } from "@/components/action-button";
import { EyeIcon, EyeOffIcon, ScanIcon, SendIcon, BellIcon, XIcon, HandCoins } from "lucide-react";

// Color mapping for common crypto tickers
const COIN_COLORS: Record<string, { bg: string; color: string }> = {
  ETH: { bg: "#1a1a1a", color: "#a8a8a8" },
  ETC: { bg: "#22c55e", color: "#ffffff" },
  ZEC: { bg: "#f59e0b", color: "#1a1a1a" },
  XMR: { bg: "#f97316", color: "#ffffff" },
  BTC: { bg: "#f7931a", color: "#ffffff" },
  USDT: { bg: "#26a17b", color: "#ffffff" },
  USDC: { bg: "#2775ca", color: "#ffffff" },
  DOT: { bg: "#e6007a", color: "#ffffff" },
  SOL: { bg: "#9945ff", color: "#ffffff" },
  DEFAULT: { bg: "#6366f1", color: "#ffffff" },
};

export default function WalletPage() {
  const [showBalance, setShowBalance] = useState(true);
  const [showProtectBanner, setShowProtectBanner] = useState(true);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCoins = async () => {
      try {
        const fetchedCoins = await fetchDotCoins();
        setCoins(fetchedCoins);
      } catch (error) {
        console.error("Failed to fetch coins:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCoins();
  }, []);

  // Calculate total balance and change from coins
  const totalBalance = coins.reduce((sum, coin) => sum + coin.fiatValue, 0);

  const formatBalance = (value: number) => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="flex flex-col gap-4 px-5 animate-fade-in">
      {/* Balance Card */}
      <div className="bg-[#1a1a1a] rounded-3xl p-6 shadow-xl">
        {/* Balance Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white text-sm font-medium">Balance</span>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="text-white hover:text-black transition-colors"
            aria-label={showBalance ? "Hide balance" : "Show balance"}
          >
            {showBalance ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeOffIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Balance Amount */}
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-white text-4xl font-bold tracking-tight">
            {showBalance ? formatBalance(totalBalance) : "••••••••"}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2 bg-white/10 rounded-2xl p-2">
          <ActionButton icon={<ScanIcon />} label="Scan" />
          <ActionButton icon={<HandCoins />} label="Receive" />
          <ActionButton icon={<SendIcon />} label="Send" />
        </div>
      </div>

      {/* Portfolio Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-lg font-semibold text-black">Portfolio</h2>
        </div>

        {isLoading ? (
          <div className="px-5 py-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : coins.length === 0 ? (
          <EmptyPortfolio />
        ) : (
          <div className="divide-y divide-gray-100">
            {coins.map((coin, index) => (
              <CoinRow key={coin.ticker} coin={coin} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Protect Wallet Banner */}
      {showProtectBanner && (
        <div className="fixed bottom-24 left-5 right-5 bg-[#1a1a1a] rounded-2xl px-4 py-4 flex items-center justify-between shadow-2xl animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <BellIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-medium">Protect your wallet</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-emerald-400 font-semibold text-sm hover:text-emerald-300 transition-colors">
              Save Secret
            </button>
            <button
              onClick={() => setShowProtectBanner(false)}
              className="text-black/40 hover:text-black/60 transition-colors"
              aria-label="Dismiss"
            >
              <XIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Empty Portfolio Component
function EmptyPortfolio() {
  return (
    <div className="px-5 py-12 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <WalletEmptyIcon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-black mb-1">
        No assets yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-[240px]">
        Your portfolio is empty. Receive or buy crypto to get started.
      </p>
    </div>
  );
}

// Coin Row Component
function CoinRow({ coin, index }: { coin: Coin; index: number }) {
  const colors = COIN_COLORS[coin.ticker] || COIN_COLORS.DEFAULT;

  return (
    <div
      className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        {/* Coin Icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: colors.bg }}
        >
          {coin.symbol ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coin.symbol}
              alt={coin.ticker}
              className="w-6 h-6 object-contain"
              onError={(e) => {
                // Fallback to text if image fails to load
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <CryptoIcon
            symbol={coin.ticker}
            color={colors.color}
            className={coin.symbol ? "hidden" : ""}
          />
        </div>

        {/* Coin Info */}
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{coin.ticker}</span>
        </div>
      </div>

      {/* Coin Value */}
      <div className="flex flex-col items-end">
        <span className="font-semibold text-foreground">{coin.amount}</span>
        <span className="text-xs text-muted-foreground">
          ¥{coin.fiatValue.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// Crypto Icon Component
function CryptoIcon({
  symbol,
  color,
  className = "",
}: {
  symbol: string;
  color: string;
  className?: string;
}) {
  const baseClass = className;
  
  switch (symbol) {
    case "ETH":
    case "ETC":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ color }}
          className={baseClass}
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
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ color }}
          className={baseClass}
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
    default:
      return (
        <span className={`text-sm font-bold ${baseClass}`} style={{ color }}>
          {symbol[0]}
        </span>
      );
  }
}

// Wallet Empty Icon
function WalletEmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
      />
    </svg>
  );
}
