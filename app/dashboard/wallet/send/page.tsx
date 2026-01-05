"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { isAddrValid } from "@/app/utils/wallet";
import { fetchDotCoins, calculatePortfolioValue, PriceMap } from "@/app/utils/crypto";
import { getKnownAssets } from "@/app/db/supabase";
import type { Coin } from "@/app/types/frontend_type";

// Color mapping for common crypto tickers
const COIN_COLORS: Record<string, { bg: string; color: string }> = {
  ETH: { bg: "#627eea", color: "#ffffff" },
  ETC: { bg: "#3ab83a", color: "#ffffff" },
  ZEC: { bg: "#f4b728", color: "#1a1a1a" },
  XMR: { bg: "#ff6600", color: "#ffffff" },
  BTC: { bg: "#f7931a", color: "#ffffff" },
  USDT: { bg: "#26a17b", color: "#ffffff" },
  USDC: { bg: "#2775ca", color: "#ffffff" },
  DOT: { bg: "#e6007a", color: "#ffffff" },
  SOL: { bg: "#9945ff", color: "#ffffff" },
  DEFAULT: { bg: "#6366f1", color: "#ffffff" },
};

export default function SendPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  
  // Form state
  const [address, setAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);
  const [amount, setAmount] = useState("");
  const [isUsdMode, setIsUsdMode] = useState(true);
  
  // UI state
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [priceMap, setPriceMap] = useState<PriceMap>({});

  // Load known assets and coins on mount
  useEffect(() => {
    const loadAssetsAndCoins = async () => {
      try {
        // First fetch known assets from Supabase
        const assets = await getKnownAssets();
        
        // Then fetch coins using known assets
        const fetchedCoins = await fetchDotCoins(assets);
        setCoins(fetchedCoins);
        setIsLoading(false);

        // Finally, fetch real-time prices and calculate portfolio value
        if (fetchedCoins.length > 0) {
          setIsPriceLoading(true);
          try {
            const { coinsWithPrices } = await calculatePortfolioValue(fetchedCoins);
            setCoins(coinsWithPrices);
            
            // Build price map from coins with prices
            const prices: PriceMap = {};
            for (const coin of coinsWithPrices) {
              if (coin.amount > 0) {
                prices[coin.ticker] = {
                  usd: coin.fiatValue / coin.amount,
                  usd_24h_change: coin.change,
                };
              }
            }
            setPriceMap(prices);
          } catch (priceError) {
            console.error("Failed to fetch prices:", priceError);
          } finally {
            setIsPriceLoading(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch coins:", error);
        setCoins([]);
        setIsLoading(false);
      }
    };
    loadAssetsAndCoins();
  }, []);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

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
    setAmount(""); // Reset amount when token changes
  };

  // Update selectedToken when coins are updated with prices
  useEffect(() => {
    if (selectedToken && coins.length > 0) {
      const updatedCoin = coins.find(c => c.ticker === selectedToken.ticker);
      if (updatedCoin && updatedCoin.fiatValue !== selectedToken.fiatValue) {
        setSelectedToken(updatedCoin);
      }
    }
  }, [coins, selectedToken]);

  const handleAmountChange = (value: string) => {
    // Only allow valid number input
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  // Get token price from price map (fallback to calculating from coin data)
  const getTokenPrice = useCallback((ticker: string): number => {
    if (priceMap[ticker]?.usd) {
      return priceMap[ticker].usd;
    }
    // Fallback: calculate from coin data if available
    const coin = coins.find(c => c.ticker === ticker);
    if (coin && coin.amount > 0 && coin.fiatValue > 0) {
      return coin.fiatValue / coin.amount;
    }
    // Default fallback for stablecoins
    if (ticker === "USDT" || ticker === "USDt" || ticker === "USDC") {
      return 1;
    }
    return 0;
  }, [priceMap, coins]);

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
      // Convert USD to crypto
      const cryptoAmount = numericAmount / price;
      setAmount(cryptoAmount.toFixed(8).replace(/\.?0+$/, ""));
    } else {
      // Convert crypto to USD
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
      // Display crypto equivalent
      const cryptoAmount = numericAmount / price;
      return cryptoAmount.toFixed(6).replace(/\.?0+$/, "");
    } else {
      // Display USD equivalent
      const usdAmount = numericAmount * price;
      return usdAmount.toFixed(2);
    }
  }, [selectedToken, amount, isUsdMode, getTokenPrice]);

  const isFormValid = () => {
    const hasValidAddress = isAddrValid(address);
    const hasToken = selectedToken !== null;
    const hasAmount = amount !== "" && parseFloat(amount) > 0;
    return hasValidAddress && hasToken && hasAmount;
  };

  const handleConfirm = () => {
    if (isFormValid() && selectedToken) {
      const price = getTokenPrice(selectedToken.ticker);
      const numericAmount = parseFloat(amount) || 0;
      
      // Calculate both USD and crypto amounts
      let amountUsd: number;
      let amountCrypto: number;
      
      if (isUsdMode) {
        amountUsd = numericAmount;
        amountCrypto = price > 0 ? numericAmount / price : 0;
      } else {
        amountCrypto = numericAmount;
        amountUsd = numericAmount * price;
      }
      
      // Navigate to payment review page with params
      const params = new URLSearchParams({
        address,
        token: selectedToken.ticker,
        amountUsd: amountUsd.toFixed(2),
        amountCrypto: amountCrypto.toFixed(6).replace(/\.?0+$/, ""),
      });
      
      router.push(`/dashboard/wallet/payment-review?${params.toString()}`);
    }
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
          Send
        </h1>
        <div className="w-10" />
      </header>

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
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
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
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: coinColors.bg }}
                        >
                          <CryptoIcon symbol={coin.ticker} color={coinColors.color} />
                        </div>
                        <span className="font-semibold text-black">{coin.ticker}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-medium text-black">{coin.amount}</div>
                          <div className="text-sm text-muted-foreground">
                            ${coin.fiatValue.toFixed(2)}
                          </div>
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
        </div>

        {/* Step 3: Amount Input */}
        <div className="animate-slide-up animation-delay-200">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Amount
          </label>
          <div className="bg-gray-50 rounded-2xl p-4">
            {/* Currency Toggle inside input area */}
            <div className="flex justify-end mb-2">
              <div className="inline-flex bg-gray-200 rounded-lg p-0.5">
                <button
                  onClick={() => !isUsdMode && toggleCurrencyMode()}
                  disabled={!selectedToken}
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
                  disabled={!selectedToken}
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
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold text-black">
                {isUsdMode ? "$" : ""}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full text-4xl font-bold bg-transparent border-none outline-none text-black placeholder:text-gray-300"
                disabled={!selectedToken}
              />
            </div>
            
            {/* Equivalent Value Display */}
            {selectedToken && (
              <div className="mt-3 flex items-center justify-between">
                {/* Show equivalent value when amount is entered */}
                <div className="text-sm text-muted-foreground">
                  {amount && parseFloat(amount) > 0 ? (
                    isPriceLoading ? (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 border border-gray-300 border-t-violet-500 rounded-full animate-spin" />
                        <span>Loading...</span>
                      </span>
                    ) : (
                      <>
                        ≈ {isUsdMode ? (
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
          Confirm
        </Button>
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
  switch (symbol) {
    case "ETH":
    case "ETC":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 20 20"
          fill="none"
          style={{ color }}
          className={className}
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
          width="24"
          height="24"
          viewBox="0 0 20 20"
          fill="none"
          style={{ color }}
          className={className}
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
        <span className={`text-lg font-bold ${className}`} style={{ color }}>
          ⓩ
        </span>
      );
    case "XMR":
      return (
        <span className={`text-lg font-bold ${className}`} style={{ color }}>
          ɱ
        </span>
      );
    default:
      return (
        <span className={`text-sm font-bold ${className}`} style={{ color }}>
          {symbol[0]}
        </span>
      );
  }
}
