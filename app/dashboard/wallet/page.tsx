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
  Compass,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ActionButton } from "@/components/action-button";
import { CoinAvatar, ChainSelector } from "@/components/crypto";
import { useCoins, useEcosystemProjects } from "@/hooks";
import { PROJECT_CATEGORIES } from "@/hooks/useEcosystemProjects";
import { fetchAllChainBalances, fetchTokenPrices, type PriceMap } from "@/app/utils/crypto";
import { formatTvl } from "@/app/utils/defillama";
import { IS_BACKED_UP_KEY, WALLET_KEY } from "@/app/types/constants";
import type { Coin, Wallet, ProjectWithStats } from "@/app/types/frontend_type";
import type { ChainId, ChainCoin } from "@/app/chains/types";
import { formatCurrency, formatCryptoAmount } from "@/lib/format";

export default function WalletPage() {
  const router = useRouter();
  const [showBalance, setShowBalance] = useState(true);
  const [showProtectBanner, setShowProtectBanner] = useState(true);
  const [isBackedUp, setIsBackedUp] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainId | "all">("all");
  const [multiChainBalances, setMultiChainBalances] = useState<Record<string, ChainCoin[]>>({});
  const [multiChainPrices, setMultiChainPrices] = useState<PriceMap>({});
  const [isLoadingMultiChain, setIsLoadingMultiChain] = useState(false);

  // Use the custom hook for Polkadot coins (backward compat)
  const { coins, isLoading, isPriceLoading, totalBalance } = useCoins();

  // Multi-chain Explore section
  const {
    isLoading: isLoadingProjects,
    selectedChain: exploreChain,
    setSelectedChain: setExploreChain,
    selectedCategory,
    setSelectedCategory,
    filteredProjects,
  } = useEcosystemProjects();

  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null);
  const [explorePage, setExplorePage] = useState(0);
  const PROJECTS_PER_PAGE = 5;

  // Reset pagination when filters change
  useEffect(() => {
    setExplorePage(0);
  }, [exploreChain, selectedCategory]);

  // Check if wallet is backed up
  useEffect(() => {
    const backedUp = localStorage.getItem(IS_BACKED_UP_KEY);
    if (backedUp) {
      setIsBackedUp(true);
    }
  }, []);

  // Fetch balances for non-Polkadot chains + their USD prices
  useEffect(() => {
    const fetchOtherChains = async () => {
      setIsLoadingMultiChain(true);
      try {
        const balances = await fetchAllChainBalances();
        setMultiChainBalances(balances);

        // Collect all non-Polkadot tickers and fetch their prices
        const tickers = new Set<string>();
        for (const [chainId, chainCoins] of Object.entries(balances)) {
          if (chainId === "polkadot") continue;
          for (const cc of chainCoins) {
            tickers.add(cc.ticker);
          }
        }
        if (tickers.size > 0) {
          const prices = await fetchTokenPrices(Array.from(tickers));
          setMultiChainPrices(prices);
        }
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
    } catch {
      /* ignore */
    }
  }, []);

  // Helper: convert a ChainCoin to a Coin using fetched prices
  const chainCoinToCoin = (cc: ChainCoin): Coin => {
    const price = multiChainPrices[cc.ticker]?.usd ?? 0;
    const change = multiChainPrices[cc.ticker]?.usd_24h_change ?? 0;
    return {
      ticker: cc.ticker,
      amount: cc.amount,
      change,
      symbol: cc.symbol,
      fiatValue: cc.amount * price,
    };
  };

  // Build unified coin list from all chains
  const getDisplayCoins = (): Coin[] => {
    if (selectedChain === "all") {
      // Show Polkadot coins from the existing hook
      const allCoins: Coin[] = [...coins];
      // Add coins from other chains
      for (const [chainId, chainCoins] of Object.entries(multiChainBalances)) {
        if (chainId === "polkadot") continue; // Already included via useCoins
        for (const cc of chainCoins) {
          allCoins.push(chainCoinToCoin(cc));
        }
      }
      return allCoins;
    }

    if (selectedChain === "polkadot") return coins;

    // Show coins for the selected chain
    const chainCoins = multiChainBalances[selectedChain] || [];
    return chainCoins.map(chainCoinToCoin);
  };

  const displayCoins = getDisplayCoins();

  // Compute the combined total balance across all chains
  const multiChainTotal = Object.entries(multiChainBalances)
    .filter(([chainId]) => chainId !== "polkadot")
    .flatMap(([, chainCoins]) => chainCoins)
    .reduce((sum, cc) => {
      const price = multiChainPrices[cc.ticker]?.usd ?? 0;
      return sum + cc.amount * price;
    }, 0);
  const combinedTotalBalance = totalBalance + multiChainTotal;

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
            {showBalance ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
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
                `$${formatCurrency(combinedTotalBalance)}`
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

      {/* Explore Ecosystems Section */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2">
          <Compass className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-semibold text-black">Relay Bazaar</h2>
        </div>

        {/* Chain Filter */}
        <div className="px-5 pb-2">
          <ChainSelector
            selectedChain={exploreChain as ChainId}
            onSelect={(id) => setExploreChain(id)}
            showAll
          />
        </div>

        {/* Category Filter Pills */}
        <div className="px-5 pb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {PROJECT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-violet-100 text-violet-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Project List (paginated) */}
        <div className="px-5 pb-4">
          {isLoadingProjects ? (
            <div className="py-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No projects found</div>
          ) : (
            <>
              <div className="space-y-2">
                {filteredProjects
                  .slice(explorePage * PROJECTS_PER_PAGE, (explorePage + 1) * PROJECTS_PER_PAGE)
                  .map((project, index) => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors animate-fade-in text-left"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <ProjectLogo project={project} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-black truncate">
                            {project.name}
                          </span>
                          <CategoryBadge category={project.category} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {project.description}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        {project.tvl !== undefined ? (
                          <>
                            <span className="text-sm font-semibold text-black">
                              {formatTvl(project.tvl)}
                            </span>
                            {project.tvlChange24h != null && (
                              <span
                                className={`flex items-center gap-0.5 text-xs font-medium ${
                                  project.tvlChange24h >= 0 ? "text-emerald-600" : "text-red-500"
                                }`}
                              >
                                {project.tvlChange24h >= 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {Math.abs(project.tvlChange24h).toFixed(1)}%
                              </span>
                            )}
                          </>
                        ) : (
                          <ChainBadge chainId={project.chainId} />
                        )}
                      </div>
                    </button>
                  ))}
              </div>

              {/* Pagination Controls */}
              {filteredProjects.length > PROJECTS_PER_PAGE && (
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
                  <button
                    onClick={() => setExplorePage((p) => Math.max(0, p - 1))}
                    disabled={explorePage === 0}
                    className="text-xs font-medium text-violet-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {explorePage + 1} / {Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() =>
                      setExplorePage((p) =>
                        Math.min(Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE) - 1, p + 1)
                      )
                    }
                    disabled={(explorePage + 1) * PROJECTS_PER_PAGE >= filteredProjects.length}
                    className="text-xs font-medium text-violet-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Project Details Bottom Sheet */}
      <Sheet
        open={selectedProject !== null}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      >
        <SheetContent side="bottom" className="px-5 pb-8 max-h-[70vh] overflow-auto">
          {selectedProject && (
            <>
              <div className="flex items-center gap-4 mb-5">
                <ProjectLogo project={selectedProject} size="lg" />
                <div className="min-w-0">
                  <SheetTitle className="text-xl font-bold text-black">
                    {selectedProject.name}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    <ChainBadge chainId={selectedProject.chainId} />
                    <CategoryBadge category={selectedProject.category} />
                  </SheetDescription>
                </div>
              </div>

              <p className="text-sm text-gray-700 leading-relaxed mb-5">
                {selectedProject.description}
              </p>

              {/* Stats */}
              {selectedProject.tvl !== undefined && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total Value Locked</p>
                    <p className="text-lg font-semibold text-black">
                      {formatTvl(selectedProject.tvl)}
                    </p>
                  </div>
                  {selectedProject.tvlChange24h != null && (
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">24h Change</p>
                      <p
                        className={`text-lg font-semibold flex items-center gap-1 ${
                          selectedProject.tvlChange24h >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {selectedProject.tvlChange24h >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {Math.abs(selectedProject.tvlChange24h).toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {selectedProject.websiteUrl && (
                  <a
                    href={selectedProject.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1a1a1a] text-white rounded-2xl py-3 px-4 text-sm font-semibold hover:bg-black/80 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open App
                  </a>
                )}
                {selectedProject.twitterUrl && (
                  <a
                    href={selectedProject.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-2xl py-3 px-4 text-sm font-semibold hover:bg-gray-200 transition-colors"
                  >
                    𝕏
                  </a>
                )}
              </div>
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
      className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        <CoinAvatar ticker={coin.ticker} symbol={coin.symbol} />
        <div className="flex flex-col">
          <span className="font-semibold text-black">{coin.ticker}</span>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <span className="font-semibold text-black">{formatCryptoAmount(coin.amount)}</span>
        <span className="text-xs text-muted-foreground">${formatCurrency(coin.fiatValue)}</span>
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

// Project Logo Component
function ProjectLogo({ project, size }: { project: ProjectWithStats; size: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "w-10 h-10", md: "w-11 h-11", lg: "w-14 h-14" };
  const imgClasses = { sm: "w-6 h-6", md: "w-7 h-7", lg: "w-9 h-9" };
  const textClasses = { sm: "text-xs", md: "text-sm", lg: "text-lg" };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0`}
    >
      {project.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.logoUrl}
          alt={project.name}
          className={`${imgClasses[size]} object-contain rounded-full`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className={`${textClasses[size]} font-bold text-gray-500`}>{project.name[0]}</span>
      )}
    </div>
  );
}

// Chain Badge Component
const CHAIN_COLORS: Record<string, string> = {
  polkadot: "#e6007a",
  base: "#0052ff",
  solana: "#9945ff",
  monad: "#836ef9",
  near: "#00ec97",
};

const CHAIN_NAMES: Record<string, string> = {
  polkadot: "Polkadot",
  base: "Base",
  solana: "Solana",
  monad: "Monad",
  near: "NEAR",
};

function ChainBadge({ chainId }: { chainId: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500">
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: CHAIN_COLORS[chainId] || "#888" }}
      />
      {CHAIN_NAMES[chainId] || chainId}
    </span>
  );
}

// Category Badge Component
const CATEGORY_STYLES: Record<string, string> = {
  dex: "bg-blue-50 text-blue-600",
  lending: "bg-amber-50 text-amber-600",
  nft: "bg-pink-50 text-pink-600",
  bridge: "bg-cyan-50 text-cyan-600",
  staking: "bg-emerald-50 text-emerald-600",
  infra: "bg-slate-100 text-slate-600",
  gaming: "bg-orange-50 text-orange-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  dex: "DeFi",
  lending: "Lending",
  nft: "NFT",
  bridge: "Bridge",
  staking: "Staking",
  infra: "Infra",
  gaming: "Gaming",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
        CATEGORY_STYLES[category] || "bg-gray-100 text-gray-500"
      }`}
    >
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}
