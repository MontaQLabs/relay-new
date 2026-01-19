"use client";

import { Loader2, Check, ChevronDown } from "lucide-react";
import { CoinAvatar } from "./CryptoIcon";
import type { Coin } from "@/app/types/frontend_type";

interface TokenPickerProps {
  coins: Coin[];
  selectedToken: Coin | null;
  onSelect: (coin: Coin) => void;
  isLoading?: boolean;
  showPicker: boolean;
  onTogglePicker: () => void;
  disabled?: boolean;
}

/**
 * Token picker component for selecting a cryptocurrency
 * Shows a button when collapsed, expandable list when open
 */
export function TokenPicker({
  coins,
  selectedToken,
  onSelect,
  isLoading = false,
  showPicker,
  onTogglePicker,
  disabled = false,
}: TokenPickerProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 bg-gray-50 rounded-xl">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading tokens...</span>
      </div>
    );
  }

  if (showPicker) {
    return (
      <div className="bg-gray-50 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
        {coins.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No tokens available
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {coins.map((coin) => {
              const isSelected = selectedToken?.ticker === coin.ticker;

              return (
                <button
                  key={coin.ticker}
                  onClick={() => onSelect(coin)}
                  disabled={disabled}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                    isSelected ? "bg-violet-50" : "hover:bg-gray-100"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-3">
                    <CoinAvatar ticker={coin.ticker} symbol={coin.symbol} size="sm" />
                    <span className="font-semibold text-black">{coin.ticker}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-sm font-medium text-black">
                        {coin.amount.toFixed(4)}
                      </div>
                      <div className="text-xs text-gray-500">
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
    );
  }

  // Collapsed state - show selected token or placeholder
  return (
    <button
      onClick={onTogglePicker}
      disabled={disabled}
      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {selectedToken ? (
        <div className="flex items-center gap-3">
          <CoinAvatar ticker={selectedToken.ticker} symbol={selectedToken.symbol} size="sm" />
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
  );
}

interface TokenListProps {
  coins: Coin[];
  selectedToken: Coin | null;
  onSelect: (coin: Coin) => void;
  isLoading?: boolean;
}

/**
 * Full token list component (always expanded)
 * Used on the Send page where the list is always visible
 */
export function TokenList({
  coins,
  selectedToken,
  onSelect,
  isLoading = false,
}: TokenListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {coins.map((coin) => {
        const isSelected = selectedToken?.ticker === coin.ticker;

        return (
          <button
            key={coin.ticker}
            onClick={() => onSelect(coin)}
            className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
              isSelected ? "bg-violet-50" : "hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <CoinAvatar ticker={coin.ticker} symbol={coin.symbol} />
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
  );
}
