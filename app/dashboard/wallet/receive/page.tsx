"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, Copy, Check } from "lucide-react";
import { fetchDotCoins, calculatePortfolioValue, fetchAllChainBalances } from "@/app/utils/crypto";
import { getWalletAddress } from "@/app/utils/wallet";
import { generateQRCode, downloadQRWithPromo } from "@/app/utils/qr";
import { getKnownAssets } from "@/app/db/supabase";
import type { Coin, KnownAsset, Wallet } from "@/app/types/frontend_type";
import type { ChainId, ChainCoin } from "@/app/chains/types";
import { WALLET_KEY } from "@/app/types/constants";
import { ChainSelector } from "@/components/crypto";
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
  USDt: { bg: "#26a17b", color: "#ffffff" },
  USDC: { bg: "#2775ca", color: "#ffffff" },
  DOT: { bg: "#e6007a", color: "#ffffff" },
  SOL: { bg: "#9945ff", color: "#ffffff" },
  MON: { bg: "#836ef9", color: "#ffffff" },
  DED: { bg: "#ff4444", color: "#ffffff" },
  PINK: { bg: "#ff69b4", color: "#ffffff" },
  DEFAULT: { bg: "#6366f1", color: "#ffffff" },
};

// Chain metadata for display
const CHAIN_META: Record<string, { name: string; color: string }> = {
  polkadot: { name: "Polkadot Asset Hub", color: "#e6007a" },
  base: { name: "Base", color: "#0052ff" },
  solana: { name: "Solana", color: "#9945ff" },
  monad: { name: "Monad", color: "#836ef9" },
  near: { name: "NEAR", color: "#00ec97" },
};

// Well-known receivable tokens per chain (shown when the user holds nothing)
interface ReceivableToken {
  ticker: string;
  name: string;
  symbol?: string;
  chainId: ChainId;
}

const DEFAULT_RECEIVABLE_TOKENS: ReceivableToken[] = [
  // Polkadot
  { ticker: "DOT", name: "Polkadot", chainId: "polkadot", symbol: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png" },
  // Base
  { ticker: "ETH", name: "Ethereum (Base)", chainId: "base", symbol: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { ticker: "USDC", name: "USD Coin (Base)", chainId: "base", symbol: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  // Solana
  { ticker: "SOL", name: "Solana", chainId: "solana", symbol: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { ticker: "USDC", name: "USD Coin (Solana)", chainId: "solana", symbol: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  // Monad
  { ticker: "MON", name: "Monad", chainId: "monad", symbol: "https://www.monad.xyz/monad-logo.png" },
  // NEAR
  { ticker: "NEAR", name: "NEAR", chainId: "near", symbol: "https://assets.coingecko.com/coins/images/10365/small/near.jpg" },
];

export default function ReceivePage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  // Chain selection
  const [selectedChain, setSelectedChain] = useState<ChainId | "all">("all");

  // Data state
  const [coins, setCoins] = useState<Coin[]>([]);
  const [multiChainBalances, setMultiChainBalances] = useState<Record<string, ChainCoin[]>>({});
  const [receivableTokens, setReceivableTokens] = useState<ReceivableToken[]>(DEFAULT_RECEIVABLE_TOKENS);
  const [isLoading, setIsLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Wallet / address state
  const [chainAccounts, setChainAccounts] = useState<{ chainId: string; address: string }[]>([]);
  const [copied, setCopied] = useState(false);

  // Sheet state
  const [selectedToken, setSelectedToken] = useState<Coin | ReceivableToken | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load chain accounts from localStorage wallet
        const walletData = localStorage.getItem(WALLET_KEY);
        if (walletData) {
          const wallet: Wallet = JSON.parse(walletData);
          setChainAccounts(wallet.chainAccounts || [{ chainId: "polkadot", address: wallet.address }]);
        }

        // Polkadot assets
        const knownAssets = await getKnownAssets();
        const polkadotTokens: ReceivableToken[] = [
          { ticker: "DOT", name: "Polkadot", chainId: "polkadot", symbol: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png" },
          ...knownAssets.map((asset: KnownAsset) => ({
            ticker: asset.ticker,
            name: asset.ticker === "USDt" ? "Tether USD" : asset.ticker === "USDC" ? "USD Coin" : asset.ticker,
            symbol: asset.symbol,
            chainId: "polkadot" as ChainId,
          })),
        ];
        setReceivableTokens([
          ...polkadotTokens,
          ...DEFAULT_RECEIVABLE_TOKENS.filter((t) => t.chainId !== "polkadot"),
        ]);

        // Fetch Polkadot balances
        const fetchedCoins = await fetchDotCoins(knownAssets);
        setCoins(fetchedCoins);
        setIsLoading(false);

        // Fetch prices
        if (fetchedCoins.length > 0) {
          setIsPriceLoading(true);
          try {
            const { coinsWithPrices } = await calculatePortfolioValue(fetchedCoins);
            setCoins(coinsWithPrices);
          } catch { /* keep raw values */ }
          finally { setIsPriceLoading(false); }
        }

        // Fetch other chains in parallel
        try {
          const balances = await fetchAllChainBalances();
          setMultiChainBalances(balances);
        } catch { /* non-critical */ }
      } catch (error) {
        console.error("Failed to load data:", error);
        setCoins([]);
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  /** The address for the currently selected chain (or primary for "all"). */
  const currentAddress = (() => {
    if (selectedChain === "all") {
      return chainAccounts.find((a) => a.chainId === "polkadot")?.address || "";
    }
    return chainAccounts.find((a) => a.chainId === selectedChain)?.address || "";
  })();

  const currentChainName = selectedChain === "all"
    ? "All Networks"
    : CHAIN_META[selectedChain]?.name || selectedChain;

  /** Coins the user actually holds, filtered to the selected chain. */
  const getOwnedCoins = (): (Coin & { chainId?: ChainId })[] => {
    if (selectedChain === "all" || selectedChain === "polkadot") {
      const result: (Coin & { chainId?: ChainId })[] = coins.map((c) => ({ ...c, chainId: "polkadot" as ChainId }));
      if (selectedChain === "all") {
        for (const [cid, chainCoins] of Object.entries(multiChainBalances)) {
          if (cid === "polkadot") continue;
          for (const cc of chainCoins) {
            result.push({
              ticker: cc.ticker,
              amount: cc.amount,
              change: 0,
              symbol: cc.symbol,
              fiatValue: 0,
              chainId: cid as ChainId,
            });
          }
        }
      }
      return result;
    }
    return (multiChainBalances[selectedChain] || []).map((cc) => ({
      ticker: cc.ticker,
      amount: cc.amount,
      change: 0,
      symbol: cc.symbol,
      fiatValue: 0,
      chainId: selectedChain,
    }));
  };

  const ownedCoins = getOwnedCoins();
  const hasOwnedCoins = ownedCoins.length > 0;

  /** Receivable tokens filtered to the selected chain. */
  const filteredReceivableTokens =
    selectedChain === "all"
      ? receivableTokens
      : receivableTokens.filter((t) => t.chainId === selectedChain);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCopyAddress = async () => {
    if (!currentAddress) return;
    try {
      await navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => router.back(), 300);
  };

  const handleTokenSelect = async (token: Coin | ReceivableToken) => {
    setSelectedToken(token);
    setIsSheetOpen(true);
    setIsGeneratingQR(true);

    // Determine the address to encode based on the token's chain
    const tokenChainId = "chainId" in token ? (token as ReceivableToken).chainId : selectedChain;
    const qrAddress = chainAccounts.find((a) => a.chainId === tokenChainId)?.address || currentAddress;

    try {
      const qrDataUrl = await generateQRCode(qrAddress, 280);
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
      const tokenChainId = "chainId" in selectedToken ? (selectedToken as ReceivableToken).chainId : selectedChain;
      const qrAddress = chainAccounts.find((a) => a.chainId === tokenChainId)?.address || currentAddress;
      await downloadQRWithPromo(
        qrCodeDataUrl,
        qrAddress,
        selectedToken.ticker,
        `relay-wallet-${selectedToken.ticker.toLowerCase()}.png`
      );
    } catch (error) {
      console.error("Failed to download QR code:", error);
    }
  };

  /** Get the displayed address for QR sheet based on selected token. */
  const getSheetAddress = () => {
    if (!selectedToken) return currentAddress;
    const tokenChainId = "chainId" in selectedToken ? (selectedToken as ReceivableToken).chainId : selectedChain;
    return chainAccounts.find((a) => a.chainId === tokenChainId)?.address || currentAddress;
  };

  const sheetAddress = getSheetAddress();
  const formattedSheetAddress = formatAddress(sheetAddress);

  const getSheetChainName = () => {
    if (!selectedToken) return currentChainName;
    const cid = "chainId" in selectedToken ? (selectedToken as ReceivableToken).chainId : selectedChain;
    return CHAIN_META[cid as string]?.name || cid;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
      <div className="flex-1 flex flex-col px-5 pt-2 gap-4 overflow-auto pb-8">
        {/* Chain Selector */}
        <div className="animate-slide-up">
          <ChainSelector
            selectedChain={selectedChain as ChainId}
            onSelect={(id) => setSelectedChain(id)}
            showAll
          />
        </div>

        {/* Wallet Address Card */}
        <div className="animate-slide-up" style={{ animationDelay: "30ms" }}>
          <div
            className="rounded-2xl p-5 text-white"
            style={{
              background:
                selectedChain === "all"
                  ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                  : `linear-gradient(135deg, ${CHAIN_META[selectedChain]?.color || "#7c3aed"}, ${lighten(CHAIN_META[selectedChain]?.color || "#7c3aed")})`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white/70 text-sm">Your Wallet Address</p>
                <p className="text-white/90 text-xs mt-0.5 font-medium">{currentChainName}</p>
              </div>
              <button
                onClick={handleCopyAddress}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                aria-label="Copy address"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Copy className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
            <p className="font-mono text-sm break-all text-white/90">
              {currentAddress || "Select a chain to view address"}
            </p>
            {copied && (
              <p className="text-xs text-white/70 mt-2">Address copied!</p>
            )}
          </div>
        </div>

        {/* Token Selection */}
        <div className="animate-slide-up" style={{ animationDelay: "60ms" }}>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            {hasOwnedCoins ? "Your Tokens" : "Supported Tokens"}
          </label>
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : hasOwnedCoins ? (
              /* Show owned coins with balances */
              <div className="divide-y divide-gray-200">
                {ownedCoins.map((coin, i) => {
                  const coinColors = COIN_COLORS[coin.ticker] || COIN_COLORS.DEFAULT;
                  const chainLabel = coin.chainId ? CHAIN_META[coin.chainId]?.name : undefined;
                  return (
                    <button
                      key={`${coin.chainId}-${coin.ticker}-${i}`}
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
                        <div className="text-left">
                          <span className="font-semibold text-black block">{coin.ticker}</span>
                          {chainLabel && selectedChain === "all" && (
                            <span className="text-xs text-muted-foreground">{chainLabel}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-black">{coin.amount}</div>
                        <div className="text-sm text-muted-foreground">
                          {isPriceLoading ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 border border-gray-300 border-t-violet-500 rounded-full animate-spin" />
                            </span>
                          ) : coin.fiatValue > 0 ? (
                            <span>${coin.fiatValue.toFixed(2)}</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Show receivable tokens across chains when user holds nothing */
              <div className="divide-y divide-gray-200">
                {filteredReceivableTokens.map((token, i) => {
                  const tokenColors = COIN_COLORS[token.ticker] || COIN_COLORS.DEFAULT;
                  const chainLabel = CHAIN_META[token.chainId]?.name;
                  return (
                    <button
                      key={`${token.chainId}-${token.ticker}-${i}`}
                      onClick={() => handleTokenSelect(token)}
                      className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: tokenColors.bg }}
                        >
                          <CryptoIcon symbol={token.ticker} color={tokenColors.color} />
                        </div>
                        <div className="text-left">
                          <span className="font-semibold text-black block">{token.ticker}</span>
                          <span className="text-xs text-muted-foreground">{token.name}</span>
                          {selectedChain === "all" && chainLabel && (
                            <span className="text-xs text-muted-foreground block">
                              on {chainLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedChain === "all" && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: CHAIN_META[token.chainId]?.color || "#6366f1" }}
                          >
                            {token.chainId === "polkadot" ? "DOT" : token.chainId.toUpperCase()}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground">Tap to receive</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Info message when no coins */}
        {!isLoading && !hasOwnedCoins && (
          <div className="animate-slide-up bg-blue-50 border border-blue-200 rounded-xl p-4" style={{ animationDelay: "90ms" }}>
            <p className="text-sm text-blue-800">
              <span className="font-medium">New wallet?</span> Select a token above to view your receive address and QR code.
              Share it with others to receive tokens on any supported network.
            </p>
          </div>
        )}
      </div>

      {/* QR Code Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" hideCloseButton className="px-0 pb-8">
          {/* Handle bar */}
          <div className="flex justify-center mb-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          {/* Title */}
          <SheetTitle className="text-center text-lg font-semibold text-black mb-1">
            Share
          </SheetTitle>
          <p className="text-center text-xs text-muted-foreground mb-4">
            {getSheetChainName()}
          </p>

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
              {typeof formattedSheetAddress === "string" ? (
                formattedSheetAddress
              ) : (
                <>
                  <div>{formattedSheetAddress.line1}</div>
                  <div>{formattedSheetAddress.line2}</div>
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddress(address: string) {
  if (!address) return "";
  if (address.length <= 24) return address;
  const midpoint = Math.ceil(address.length / 2);
  return {
    line1: address.slice(0, midpoint),
    line2: address.slice(midpoint),
  };
}

/** Lighten a hex colour for gradient end. */
function lighten(hex: string): string {
  try {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 40);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 40);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 40);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return hex;
  }
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
            B
          </text>
        </svg>
      );
    case "ZEC":
      return (
        <span className={`text-lg font-bold ${className}`} style={{ color }}>
          Z
        </span>
      );
    case "XMR":
      return (
        <span className={`text-lg font-bold ${className}`} style={{ color }}>
          M
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
