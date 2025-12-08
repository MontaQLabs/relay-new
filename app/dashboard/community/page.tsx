"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { authenticateWithWallet, isAuthenticated } from "@/app/utils/auth";
import { getWalletAddress } from "@/app/utils/wallet";
import { getUserCommunities, getCreatedCommunities, searchCommunities, getAllCommunities } from "@/app/db/supabase";
import { Community } from "@/app/types/frontend_type";
import { EmptyState } from "@/components/empty-state";
import { CommunityList } from "@/components/community";

type TabType = "all" | "joined" | "created";

export default function CommunityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [createdCommunities, setCreatedCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Community[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Authenticate user on load
  useEffect(() => {
    const authenticate = async () => {
      setIsAuthenticating(true);
      setAuthError(null);
      
      try {
        // Check if already authenticated
        if (isAuthenticated()) {
          setWalletAddress(getWalletAddress() ?? undefined);
          setIsAuthenticating(false);
          return;
        }

        // Authenticate the user using their wallet
        const result = await authenticateWithWallet();
        
        if (!result.success) {
          // Authentication failed - user may not have a wallet set up yet
          // Don't redirect, just show the page (they can still view empty state)
          console.log("Authentication note:", result.error);
          setAuthError(result.error || null);
        } else {
          setWalletAddress(getWalletAddress() ?? undefined);
        }
      } catch (error) {
        console.error("Authentication error:", error);
        setAuthError(error instanceof Error ? error.message : "Authentication failed");
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticate();
  }, []);

  // Fetch communities after authentication
  const fetchCommunities = useCallback(async () => {
    const wallet = getWalletAddress();
    setIsLoading(true);
    
    try {
      // Always fetch all communities for the "all" tab
      const all = await getAllCommunities();
      setAllCommunities(all);

      // Fetch user-specific communities if wallet is available
      if (wallet) {
        const [joined, created] = await Promise.all([
          getUserCommunities(wallet),
          getCreatedCommunities(wallet),
        ]);
        
        setJoinedCommunities(joined);
        setCreatedCommunities(created);
      }
    } catch (error) {
      console.error("Failed to fetch communities:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticating) return;
    fetchCommunities();
  }, [isAuthenticating, fetchCommunities]);

  const handleCreateCommunity = () => {
    router.push("/dashboard/community/create-community");
  };

  // Debounced search handler
  const handleSearch = useCallback(async (term: string) => {
    setSearchTerm(term);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!term.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchCommunities(term);
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
  };

  // Handle successful join - refresh the lists
  const handleJoinSuccess = () => {
    fetchCommunities();
  };

  const getCurrentCommunities = () => {
    switch (activeTab) {
      case "joined":
        return joinedCommunities;
      case "created":
        return createdCommunities;
      case "all":
        return allCommunities;
      default:
        return [];
    }
  };

  const currentCommunities = getCurrentCommunities();

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Determine what to display
  const showSearchResults = searchTerm.trim().length > 0;

  return (
    <div className="flex flex-col animate-fade-in">
      {/* Search Box */}
      <div className="px-5 pt-4 pb-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search communities..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-100 border-0 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all text-black"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-3 flex items-center"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Auth Error Banner (if wallet not set up) */}
      {authError && (
        <div className="mx-5 mt-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">{authError}</p>
        </div>
      )}

      {/* Search Results */}
      {showSearchResults ? (
        <div className="flex flex-col">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm text-muted-foreground">
              {isSearching
                ? "Searching..."
                : searchResults.length === 0
                ? "No communities found"
                : `${searchResults.length} ${searchResults.length === 1 ? "community" : "communities"} found`}
            </p>
          </div>
          {!isSearching && searchResults.length > 0 && (
            <CommunityList 
              communities={searchResults} 
              currentUserWallet={walletAddress}
              showJoinButton={true}
              onJoinSuccess={handleJoinSuccess}
            />
          )}
          {isSearching && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex items-center gap-6 px-5 border-b border-gray-100">
            <TabButton
              label="All"
              isActive={activeTab === "all"}
              onClick={() => setActiveTab("all")}
            />
            <TabButton
              label="Joined"
              isActive={activeTab === "joined"}
              onClick={() => setActiveTab("joined")}
            />
            <TabButton
              label="Created"
              isActive={activeTab === "created"}
              onClick={() => setActiveTab("created")}
            />
          </div>

          {/* Create Community Button */}
          <div className="px-5 py-4">
            <button
              onClick={handleCreateCommunity}
              className="flex items-center gap-4 w-full text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <Plus className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-black">Create a Community</span>
                <span className="text-sm text-muted-foreground">Be a leader</span>
              </div>
            </button>
          </div>

          {/* Content Area */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : currentCommunities.length === 0 ? (
            <EmptyState activeTab={activeTab} />
          ) : (
            <CommunityList 
              communities={currentCommunities} 
              currentUserWallet={walletAddress}
              showJoinButton={activeTab === "all"}
              onJoinSuccess={handleJoinSuccess}
            />
          )}
        </>
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative py-3 font-medium transition-colors ${
        isActive ? "text-black" : "text-muted-foreground hover:text-gray-600"
      }`}
    >
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />
      )}
    </button>
  );
}
