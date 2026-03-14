"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const fetchIdRef = useRef(0);

  const fetchCoins = useCallback(async () => {
    const id = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const assets = await getKnownAssets();
      if (id !== fetchIdRef.current) return;
      setKnownAssets(assets);

      const fetchedCoins = await fetchDotCoins(assets);
      if (id !== fetchIdRef.current) return;
      setCoins(fetchedCoins);
      setIsLoading(false);

      const fallbackTotal = fetchedCoins.reduce((sum, coin) => sum + coin.fiatValue, 0);
      setTotalBalance(fallbackTotal);

      if (fetchPrices && fetchedCoins.length > 0) {
        setIsPriceLoading(true);
        try {
          const { totalValue, coinsWithPrices } = await calculatePortfolioValue(fetchedCoins);
          if (id !== fetchIdRef.current) return;
          setCoins(coinsWithPrices);
          setTotalBalance(totalValue);

          if (selectedToken) {
            const updatedToken = coinsWithPrices.find((c) => c.ticker === selectedToken.ticker);
            if (updatedToken) {
              setSelectedToken(updatedToken);
            }
          }
        } catch (priceError) {
          console.error("Failed to fetch prices:", priceError);
        } finally {
          if (id === fetchIdRef.current) setIsPriceLoading(false);
        }
      }
    } catch (err) {
      if (id !== fetchIdRef.current) return;
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
    return () => {
      fetchIdRef.current++;
    };
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
