"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  EyeOffIcon,
  ScanIcon,
  SendIcon,
  BellIcon,
  XIcon,
  HandCoins,
  Loader2,
  Store,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ActionButton } from "@/components/action-button";
import { CoinAvatar, ChainSelector } from "@/components/crypto";
import { useCoins } from "@/hooks";
import { fetchAssetDetails, AssetDetails, fetchAllChainBalances } from "@/app/utils/crypto";
import { IS_BACKED_UP_KEY, WALLET_KEY } from "@/app/types/constants";
import type { KnownAsset, Coin, Wallet } from "@/app/types/frontend_type";
import type { ChainId, ChainCoin } from "@/app/chains/types";
import { formatCurrency, formatCryptoAmount } from "@/lib/format";

export default function WalletPage() {
  const router = useRouter();
  const [showBalance, setShowBalance] = useState(true);
  const [showProtectBanner, setShowProtectBanner] = useState(true);
  const [isBackedUp, setIsBackedUp] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainId | "all">("all");
  const [multiChainBalances, setMultiChainBalances] = useState<Record<string, ChainCoin[]>>({});
  const [isLoadingMultiChain, setIsLoadingMultiChain] = useState(false);

  // Use the custom hook for Polkadot coins (backward compat)
  const { coins, knownAssets, isLoading, isPriceLoading, totalBalance } = useCoins();

  // Polkadot Bazaar state
  const [selectedAsset, setSelectedAsset] = useState<KnownAsset | null>(null);
  const [assetDetails, setAssetDetails] = useState<AssetDetails | null>(null);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);

  // Check if wallet is backed up
  useEffect(() => {
    const backedUp = localStorage.getItem(IS_BACKED_UP_KEY);
    if (backedUp) {
      setIsBackedUp(true);
    }
  }, []);

  // Fetch asset details when an asset is selected
  const handleAssetClick = async (asset: KnownAsset) => {
    setSelectedAsset(asset);
    setAssetDetails(null);
    setIsLoadingAsset(true);

    try {
      const details = await fetchAssetDetails(asset.id, asset.symbol, asset);
      setAssetDetails(details);
    } catch (error) {
      console.error("Failed to fetch asset details:", error);
    } finally {
      setIsLoadingAsset(false);
    }
  };

  const handleCloseAssetSheet = () => {
    setSelectedAsset(null);
    setAssetDetails(null);
  };

  // Fetch balances for non-Polkadot chains
  useEffect(() => {
    const fetchOtherChains = async () => {
      setIsLoadingMultiChain(true);
      try {
        const balances = await fetchAllChainBalances();
        setMultiChainBalances(balances);
      } catch (err) {
        console.error("Failed to fetch multi-chain balances:", err);
      } finally {
        setIsLoadingMultiChain(false);
      }
    };
    fetchOtherChains();
  }, []);

  // Get wallet chain accounts for address display
  const [chainAccounts, setChainAccounts] = useState<{ chainId: string; address: string }[]>([]);
  useEffect(() => {
    try {
      const walletData = localStorage.getItem(WALLET_KEY);
      if (walletData) {
        const wallet: Wallet = JSON.parse(walletData);
        setChainAccounts(wallet.chainAccounts || []);
      }
    } catch { /* ignore */ }
  }, []);

  // Build unified coin list from all chains
  const getDisplayCoins = (): Coin[] => {
    if (selectedChain === "all") {
      // Show Polkadot coins from the existing hook
      const allCoins: Coin[] = [...coins];
      // Add coins from other chains
      for (const [chainId, chainCoins] of Object.entries(multiChainBalances)) {
        if (chainId === "polkadot") continue; // Already included via useCoins
        for (const cc of chainCoins) {
          allCoins.push({
            ticker: cc.ticker,
            amount: cc.amount,
            change: 0,
            symbol: cc.symbol,
            fiatValue: 0,
          });
        }
      }
      return allCoins;
    }

    if (selectedChain === "polkadot") return coins;

    // Show coins for the selected chain
    const chainCoins = multiChainBalances[selectedChain] || [];
    return chainCoins.map((cc) => ({
      ticker: cc.ticker,
      amount: cc.amount,
      change: 0,
      symbol: cc.symbol,
      fiatValue: 0,
    }));
  };

  const displayCoins = getDisplayCoins();

  const handleSaveSecret = () => {
    router.push("/dashboard/settings");
  };

  return (
    <div className="flex flex-col gap-4 px-5 animate-fade-in">
      {/* Balance Card */}
      <div className="bg-[#1a1a1a] rounded-3xl p-6 shadow-xl">
        {/* Balance Header */}
        <div className="flex items-center gap-2 mb-2 px-2">
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
        <div className="flex items-baseline gap-3 mb-4 px-1">
          <span className="text-white text-4xl font-bold tracking-tight">
            {showBalance ? (
              isPriceLoading ? (
                <span className="flex items-center gap-2">
                  <span className="text-white/60">$</span>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : (
                `$${formatCurrency(totalBalance)}`
              )
            ) : (
              "••••••••"
            )}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2 bg-white/10 rounded-2xl p-2">
          <ActionButton icon={<ScanIcon />} label="Scan" />
          <ActionButton icon={<HandCoins />} label="Receive" />
          <ActionButton icon={<SendIcon />} label="Send" />
        </div>
      </div>

      {/* Chain Selector */}
      <div className="bg-white rounded-3xl border border-gray-100 px-4 py-3">
        <ChainSelector
          selectedChain={selectedChain as ChainId}
          onSelect={(id) => setSelectedChain(id)}
          showAll
        />
      </div>

      {/* Chain Accounts (addresses) */}
      {selectedChain !== "all" && chainAccounts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          {chainAccounts
            .filter((a) => a.chainId === selectedChain)
            .map((a) => (
              <div key={a.chainId} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Address</span>
                <span className="text-xs font-mono text-gray-700 truncate max-w-[220px]">
                  {a.address}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Portfolio Section */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-lg font-semibold text-black">Portfolio</h2>
        </div>

        {isLoading || isLoadingMultiChain ? (
          <div className="px-5 py-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : displayCoins.length === 0 ? (
          <EmptyPortfolio />
        ) : (
          <div className="divide-y divide-gray-100">
            {displayCoins.map((coin, index) => (
              <CoinRow key={`${selectedChain}-${coin.ticker}`} coin={coin} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Polkadot Bazaar Section */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2">
          <Store className="w-5 h-5 text-pink-500" />
          <h2 className="text-lg font-semibold text-black">Polkadot Bazaar</h2>
        </div>

        <div className="px-5 pb-4">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
            </div>
          ) : knownAssets.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No assets available
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {[...knownAssets]
                .sort((a, b) => {
                  const priority: Record<string, number> = { USDt: 0, USDC: 1 };
                  const aPriority = priority[a.ticker] ?? 999;
                  const bPriority = priority[b.ticker] ?? 999;
                  return aPriority - bPriority;
                })
                .map((asset, index) => (
                  <button
                    key={asset.id}
                    onClick={() => handleAssetClick(asset)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                      {asset.symbol ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.symbol}
                          alt={asset.ticker}
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-sm font-bold text-gray-500">
                          {asset.ticker[0]}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700 truncate w-full text-center">
                      {asset.ticker}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Asset Details Bottom Sheet */}
      <Sheet
        open={selectedAsset !== null}
        onOpenChange={(open) => !open && handleCloseAssetSheet()}
      >
        <SheetContent side="bottom" className="px-5 pb-8 max-h-[70vh] overflow-auto">
          {selectedAsset && (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {selectedAsset.symbol ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedAsset.symbol}
                      alt={selectedAsset.ticker}
                      className="w-10 h-10 object-contain"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-gray-500">
                      {selectedAsset.ticker[0]}
                    </span>
                  )}
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold text-black">
                    {assetDetails?.name || selectedAsset.ticker}
                  </SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground">
                    {selectedAsset.ticker} • Asset ID: {selectedAsset.id}
                  </SheetDescription>
                </div>
              </div>

              {isLoadingAsset && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                </div>
              )}

              {!isLoadingAsset && assetDetails && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Supply</p>
                      <p className="text-lg font-semibold text-black">{assetDetails.supply}</p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">Holders</p>
                      <p className="text-lg font-semibold text-black">
                        {assetDetails.accounts.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">Decimals</p>
                      <p className="text-lg font-semibold text-black">{assetDetails.decimals}</p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">Min Balance</p>
                      <p className="text-lg font-semibold text-black">{assetDetails.minBalance}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        assetDetails.isFrozen
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {assetDetails.isFrozen ? "Frozen" : "Active"}
                    </span>
                    {assetDetails.isSufficient && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Sufficient
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Owner</p>
                      <p className="text-sm font-mono text-black bg-gray-50 px-3 py-2 rounded-xl truncate">
                        {assetDetails.owner}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Admin</p>
                      <p className="text-sm font-mono text-black bg-gray-50 px-3 py-2 rounded-xl truncate">
                        {assetDetails.admin}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Issuer</p>
                      <p className="text-sm font-mono text-black bg-gray-50 px-3 py-2 rounded-xl truncate">
                        {assetDetails.issuer}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isLoadingAsset && !assetDetails && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <XIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Unable to fetch asset details. Please try again later.
                  </p>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Protect Wallet Banner */}
      {showProtectBanner && !isBackedUp && (
        <div className="fixed bottom-24 left-5 right-5 bg-[#1a1a1a] rounded-2xl px-4 py-4 flex items-center justify-between shadow-2xl animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <BellIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-medium">Protect your wallet</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSecret}
              className="text-emerald-400 font-semibold text-sm hover:text-emerald-300 transition-colors"
            >
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
      <h3 className="text-base font-semibold text-black mb-1">No assets yet</h3>
      <p className="text-sm text-muted-foreground max-w-[240px]">
        Your portfolio is empty. Receive or buy crypto to get started.
      </p>
    </div>
  );
}

// Coin Row Component
function CoinRow({ coin, index }: { coin: Coin; index: number }) {
  return (
    <div
      className="flex items-center justify-between px-5 pb-4 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        <CoinAvatar ticker={coin.ticker} symbol={coin.symbol} />
        <div className="flex flex-col">
          <span className="font-semibold text-black">{coin.ticker}</span>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <span className="font-semibold text-black">
          {formatCryptoAmount(coin.amount)}
        </span>
        <span className="text-xs text-muted-foreground">
          ${formatCurrency(coin.fiatValue)}
        </span>
      </div>
    </div>
  );
}

// Wallet Empty Icon
function WalletEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
      />
    </svg>
  );
}
