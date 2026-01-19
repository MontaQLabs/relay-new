"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchDotCoins, calculatePortfolioValue } from "@/app/utils/crypto";
import { getKnownAssets } from "@/app/db/supabase";
import type { Coin, KnownAsset } from "@/app/types/frontend_type";

interface UseCoinsOptions {
  autoFetch?: boolean;
  fetchPrices?: boolean;
}

interface UseCoinsReturn {
  coins: Coin[];
  knownAssets: KnownAsset[];
  isLoading: boolean;
  isPriceLoading: boolean;
  totalBalance: number;
  error: string | null;
  refetch: () => Promise<void>;
  selectedToken: Coin | null;
  setSelectedToken: (coin: Coin | null) => void;
}

/**
 * Hook for fetching and managing cryptocurrency coins
 * Handles loading coins, fetching prices, and calculating portfolio value
 */
export function useCoins(options: UseCoinsOptions = {}): UseCoinsReturn {
  const { autoFetch = true, fetchPrices = true } = options;

  const [coins, setCoins] = useState<Coin[]>([]);
  const [knownAssets, setKnownAssets] = useState<KnownAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);

  const fetchCoins = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First, fetch known assets from Supabase
      const assets = await getKnownAssets();
      setKnownAssets(assets);

      // Then, fetch the coins from the blockchain using the known assets
      const fetchedCoins = await fetchDotCoins(assets);
      setCoins(fetchedCoins);
      setIsLoading(false);

      // Calculate fallback total from raw coin values
      const fallbackTotal = fetchedCoins.reduce((sum, coin) => sum + coin.fiatValue, 0);
      setTotalBalance(fallbackTotal);

      // Finally, fetch real-time prices if enabled
      if (fetchPrices && fetchedCoins.length > 0) {
        setIsPriceLoading(true);
        try {
          const { totalValue, coinsWithPrices } = await calculatePortfolioValue(fetchedCoins);
          setCoins(coinsWithPrices);
          setTotalBalance(totalValue);

          // Update selected token with new price data
          if (selectedToken) {
            const updatedToken = coinsWithPrices.find(
              (c) => c.ticker === selectedToken.ticker
            );
            if (updatedToken) {
              setSelectedToken(updatedToken);
            }
          }
        } catch (priceError) {
          console.error("Failed to fetch prices:", priceError);
          // Keep the coins without price data
        } finally {
          setIsPriceLoading(false);
        }
      }
    } catch (err) {
      console.error("Failed to fetch coins:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch coins");
      setCoins([]);
      setIsLoading(false);
    }
  }, [fetchPrices, selectedToken]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchCoins();
    }
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update selected token when coins are updated with prices
  useEffect(() => {
    if (selectedToken && coins.length > 0) {
      const updatedCoin = coins.find((c) => c.ticker === selectedToken.ticker);
      if (updatedCoin && updatedCoin.fiatValue !== selectedToken.fiatValue) {
        setSelectedToken(updatedCoin);
      }
    }
  }, [coins, selectedToken]);

  return {
    coins,
    knownAssets,
    isLoading,
    isPriceLoading,
    totalBalance,
    error,
    refetch: fetchCoins,
    selectedToken,
    setSelectedToken,
  };
}
