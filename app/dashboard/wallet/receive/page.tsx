"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { fetchDotCoins, calculatePortfolioValue } from "@/app/utils/crypto";
import { getWalletAddress } from "@/app/utils/wallet";
import { generateQRCode, downloadQRWithPromo } from "@/app/utils/qr";
import { getKnownAssets } from "@/app/db/supabase";
import type { Coin } from "@/app/types/frontend_type";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

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

export default function ReceivePage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  
  // Data state
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  
  // Sheet state
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  
  // Load coins and wallet address on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get wallet address
        const address = getWalletAddress();
        if (address) {
          setWalletAddress(address);
        } else {
          // Use a demo address for testing
          setWalletAddress("1exaAg2VJRQbyUBAeXcktChCAqjVP9TUxF3zo23R2T6EGdE");
        }
        
        // First fetch known assets from Supabase
        const knownAssets = await getKnownAssets();
        
        // Then fetch coins using known assets
        const fetchedCoins = await fetchDotCoins(knownAssets);
        setCoins(fetchedCoins);
        setIsLoading(false);

        // Finally, fetch real-time prices and calculate portfolio value
        if (fetchedCoins.length > 0) {
          setIsPriceLoading(true);
          try {
            const { coinsWithPrices } = await calculatePortfolioValue(fetchedCoins);
            setCoins(coinsWithPrices);
          } catch (priceError) {
            console.error("Failed to fetch prices:", priceError);
          } finally {
            setIsPriceLoading(false);
          }
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        // Use demo address on error
        setWalletAddress("1exaAg2VJRQbyUBAeXcktChCAqjVP9TUxF3zo23R2T6EGdE");
        setCoins([]);
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleTokenSelect = async (coin: Coin) => {
    setSelectedToken(coin);
    setIsSheetOpen(true);
    setIsGeneratingQR(true);
    
    try {
      const qrDataUrl = await generateQRCode(walletAddress, 280);
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleDownload = async () => {
    if (!qrCodeDataUrl || !selectedToken) return;
    
    try {
      await downloadQRWithPromo(
        qrCodeDataUrl,
        walletAddress,
        selectedToken.ticker,
        `relay-wallet-${selectedToken.ticker.toLowerCase()}.png`
      );
    } catch (error) {
      console.error("Failed to download QR code:", error);
    }
  };

  // Format address for display (split into two lines)
  const formatAddress = (address: string) => {
    if (address.length <= 24) return address;
    const midpoint = Math.ceil(address.length / 2);
    return {
      line1: address.slice(0, midpoint),
      line2: address.slice(midpoint),
    };
  };

  const formattedAddress = formatAddress(walletAddress);

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
          Receive
        </h1>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-4 gap-4 overflow-auto">
        {/* Token Selection */}
        <div className="animate-slide-up">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Select Token to Receive
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
                  
                  return (
                    <button
                      key={coin.ticker}
                      onClick={() => handleTokenSelect(coin)}
                      className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-100"
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
                            {isPriceLoading ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 border border-gray-300 border-t-violet-500 rounded-full animate-spin" />
                                <span>${coin.fiatValue.toFixed(2)}</span>
                              </span>
                            ) : (
                              <span>${coin.fiatValue.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" hideCloseButton className="px-0 pb-8">
          {/* Handle bar */}
          <div className="flex justify-center mb-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
          
          {/* Title */}
          <SheetTitle className="text-center text-lg font-semibold text-black mb-4">
            Share
          </SheetTitle>
          
          {/* QR Card */}
          <div className="mx-5 border border-gray-200 rounded-2xl p-6 bg-white">
            {/* QR Code */}
            <div className="flex justify-center mb-4">
              {isGeneratingQR ? (
                <div className="w-[260px] h-[260px] flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code"
                  className="w-[260px] h-[260px]"
                />
              )}
            </div>
            
            {/* Only accept text */}
            <p className="text-center text-base font-semibold text-black mb-4">
              Only accept {selectedToken?.ticker || ""}
            </p>
            
            {/* Wallet Address */}
            <div className="text-center text-sm text-gray-500 font-mono mb-6">
              {typeof formattedAddress === "string" ? (
                formattedAddress
              ) : (
                <>
                  <div>{formattedAddress.line1}</div>
                  <div>{formattedAddress.line2}</div>
                </>
              )}
            </div>
            
            {/* Separator */}
            <div className="border-t border-gray-200 my-4" />
            
            {/* Promo Section */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Relay Wallet</p>
                <p className="text-base font-semibold text-black">
                  Start your crypto journey here!
                </p>
              </div>
              {/* Small QR placeholder */}
              <div className="w-12 h-12 border-2 border-gray-800 rounded-md flex items-center justify-center">
                <div className="w-8 h-8 grid grid-cols-3 grid-rows-3 gap-0.5">
                  <div className="bg-gray-800 rounded-sm" />
                  <div className="bg-transparent" />
                  <div className="bg-gray-800 rounded-sm" />
                  <div className="bg-transparent" />
                  <div className="bg-gray-800 rounded-sm" />
                  <div className="bg-transparent" />
                  <div className="bg-gray-800 rounded-sm" />
                  <div className="bg-transparent" />
                  <div className="bg-gray-800 rounded-sm" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Download Button */}
          <div className="px-5 mt-6">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-4 bg-violet-100 hover:bg-violet-200 text-violet-600 font-semibold rounded-2xl transition-colors"
            >
              <Download className="w-5 h-5" />
              Save
            </button>
          </div>
        </SheetContent>
      </Sheet>
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
