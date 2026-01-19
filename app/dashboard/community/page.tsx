"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { getWalletAddress } from "@/app/utils/wallet";
import { Community } from "@/app/types/frontend_type";
import { EmptyState } from "@/components/empty-state";
import { CommunityList } from "@/components/community";
import { TabButton } from "@/components/ui/tab-button";
import { useAuth } from "@/hooks";

type TabType = "All" | "Joined" | "Created";

export default function CommunityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [createdCommunities, setCreatedCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Community[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use auth hook
  const { isAuthenticating, authError, walletAddress } = useAuth();

  // Fetch communities after authentication
  const fetchCommunities = useCallback(async () => {
    const wallet = getWalletAddress();
    setIsLoading(true);

    try {
      const allResponse = await fetch("/api/community?type=all");
      if (allResponse.ok) {
        const allData = await allResponse.json();
        setAllCommunities(allData.communities || []);
      }

      if (wallet) {
        const [joinedResponse, createdResponse] = await Promise.all([
          fetch(`/api/community?type=joined&wallet=${encodeURIComponent(wallet)}`),
          fetch(`/api/community?type=created&wallet=${encodeURIComponent(wallet)}`),
        ]);

        if (joinedResponse.ok) {
          const joinedData = await joinedResponse.json();
          setJoinedCommunities(joinedData.communities || []);
        }

        if (createdResponse.ok) {
          const createdData = await createdResponse.json();
          setCreatedCommunities(createdData.communities || []);
        }
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

  const handleSearch = useCallback(async (term: string) => {
    setSearchTerm(term);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!term.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/community/search?q=${encodeURIComponent(term)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.communities || []);
        } else {
          setSearchResults([]);
        }
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

  const handleJoinSuccess = () => fetchCommunities();
  const handleLeaveSuccess = () => fetchCommunities();

  const getCurrentCommunities = () => {
    switch (activeTab) {
      case "Joined":
        return joinedCommunities;
      case "Created":
        return createdCommunities;
      case "All":
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

  const showSearchResults = searchTerm.trim().length > 0;

  // Map activeTab to EmptyState's expected type
  const emptyStateTab = activeTab.toLowerCase() as "all" | "joined" | "created";

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
            <button onClick={clearSearch} className="absolute inset-y-0 right-3 flex items-center">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Auth Error Banner */}
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
              currentUserWallet={walletAddress || undefined}
              showJoinButton={true}
              onJoinSuccess={handleJoinSuccess}
              onLeaveSuccess={handleLeaveSuccess}
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
            {(["All", "Joined", "Created"] as TabType[]).map((tab) => (
              <TabButton
                key={tab}
                label={tab}
                isActive={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              />
            ))}
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
            <EmptyState activeTab={emptyStateTab} />
          ) : (
            <CommunityList
              communities={currentCommunities}
              currentUserWallet={walletAddress || undefined}
              showJoinButton={activeTab === "All"}
              onJoinSuccess={handleJoinSuccess}
              onLeaveSuccess={handleLeaveSuccess}
            />
          )}
        </>
      )}
    </div>
  );
}
