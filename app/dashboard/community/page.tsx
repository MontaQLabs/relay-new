"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authenticateWithWallet, isAuthenticated } from "@/app/utils/auth";
import { getWalletAddress } from "@/app/utils/wallet";
import { getUserCommunities, getCreatedCommunities } from "@/app/db/supabase";
import { Community } from "@/app/types/frontend_type";

type TabType = "joined" | "created";

// Random avatar colors for communities without avatars
const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

// Generate a consistent color based on community ID
const getAvatarColor = (communityId: string): string => {
  let hash = 0;
  for (let i = 0; i < communityId.length; i++) {
    hash = communityId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Generate a random avatar URL using DiceBear
const getRandomAvatar = (communityId: string): string => {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${communityId}`;
};

export default function CommunityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("joined");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [createdCommunities, setCreatedCommunities] = useState<Community[]>([]);

  // Authenticate user on load
  useEffect(() => {
    const authenticate = async () => {
      setIsAuthenticating(true);
      setAuthError(null);
      
      try {
        // Check if already authenticated
        if (isAuthenticated()) {
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
    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [joined, created] = await Promise.all([
        getUserCommunities(walletAddress),
        getCreatedCommunities(walletAddress),
      ]);
      
      setJoinedCommunities(joined);
      setCreatedCommunities(created);
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

  const currentCommunities =
    activeTab === "joined" ? joinedCommunities : createdCommunities;

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-fade-in">
      {/* Auth Error Banner (if wallet not set up) */}
      {authError && (
        <div className="mx-5 mt-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">{authError}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-6 px-5 border-b border-gray-100">
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
        <CommunityList communities={currentCommunities} />
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

// Empty State Component
function EmptyState({ activeTab }: { activeTab: TabType }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      {/* Empty Box Illustration */}
      <div className="relative mb-8">
        <EmptyBoxIllustration />
      </div>

      <h3 className="text-lg font-semibold text-black mb-2">
        {activeTab === "joined"
          ? "You haven't joined any community"
          : "You haven't created any community"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        {activeTab === "joined"
          ? "You can create a community or search the community ID you want to join."
          : "Create your first community and become a leader."}
      </p>
    </div>
  );
}

// Swipeable Community Item Component
function SwipeableCommunityItem({
  community,
  onClick,
}: {
  community: Community;
  onClick: () => void;
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80; // Width of the quit button
  const CLICK_THRESHOLD = 5; // Minimum movement to consider as swipe

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
    setHasMoved(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = startXRef.current - currentX;
    
    if (Math.abs(diff) > CLICK_THRESHOLD) {
      setHasMoved(true);
    }
    
    // Only allow swiping left (positive diff) and limit the swipe
    const newOffset = Math.min(Math.max(0, diff), SWIPE_THRESHOLD);
    setSwipeOffset(newOffset);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // Snap to either fully open or closed
    if (swipeOffset > SWIPE_THRESHOLD / 2) {
      setSwipeOffset(SWIPE_THRESHOLD);
    } else {
      setSwipeOffset(0);
    }
    
    // Handle click if no swipe occurred
    if (!hasMoved && swipeOffset === 0) {
      onClick();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    setIsDragging(true);
    setHasMoved(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = startXRef.current - e.clientX;
    
    if (Math.abs(diff) > CLICK_THRESHOLD) {
      setHasMoved(true);
    }
    
    const newOffset = Math.min(Math.max(0, diff), SWIPE_THRESHOLD);
    setSwipeOffset(newOffset);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (swipeOffset > SWIPE_THRESHOLD / 2) {
      setSwipeOffset(SWIPE_THRESHOLD);
    } else {
      setSwipeOffset(0);
    }
    
    // Handle click if no swipe occurred
    if (!hasMoved && swipeOffset === 0) {
      onClick();
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (swipeOffset > SWIPE_THRESHOLD / 2) {
        setSwipeOffset(SWIPE_THRESHOLD);
      } else {
        setSwipeOffset(0);
      }
    }
  };

  // Format community ID for display
  const displayId = community.communityId.replace(/^comm_/, "").slice(0, 7);

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
      onMouseLeave={handleMouseLeave}
    >
      {/* Quit Button (behind the main content) */}
      <div 
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500"
        style={{ width: SWIPE_THRESHOLD }}
      >
        <Button
          variant="ghost"
          className="text-white font-semibold hover:bg-red-600 h-full w-full rounded-none"
          disabled
        >
          Quit
        </Button>
      </div>

      {/* Main Content (slides over the quit button) */}
      <div
        className="relative bg-white flex items-center gap-4 px-5 py-4 cursor-pointer transition-transform hover:bg-gray-50"
        style={{
          transform: `translateX(-${swipeOffset}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Avatar */}
        <div 
          className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
            !community.avatar ? getAvatarColor(community.communityId) : ""
          }`}
        >
          {community.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.avatar}
              alt={community.name}
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getRandomAvatar(community.communityId)}
              alt={community.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Community Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-black truncate">
            {community.name}
          </h4>
          <p className="text-sm text-muted-foreground">
            ID: {displayId}
          </p>
        </div>
      </div>
    </div>
  );
}

// Community List Component
function CommunityList({ communities }: { communities: Community[] }) {
  const router = useRouter();

  const handleCommunityClick = (communityId: string) => {
    router.push(`/dashboard/community/${communityId}`);
  };

  return (
    <div className="divide-y divide-gray-100">
      {communities.map((community) => (
        <SwipeableCommunityItem 
          key={community.communityId} 
          community={community}
          onClick={() => handleCommunityClick(community.communityId)}
        />
      ))}
    </div>
  );
}

// Empty Box Illustration SVG Component
function EmptyBoxIllustration() {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shadow */}
      <ellipse cx="100" cy="145" rx="60" ry="8" fill="#F3F4F6" />

      {/* Box base - back */}
      <path
        d="M40 80 L100 110 L160 80 L160 130 L100 150 L40 130 Z"
        fill="white"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />

      {/* Box left flap */}
      <path
        d="M40 80 L40 60 L70 40 L100 60 L100 80 L70 100 Z"
        fill="white"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />

      {/* Box right flap */}
      <path
        d="M160 80 L160 60 L130 40 L100 60 L100 80 L130 100 Z"
        fill="white"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />

      {/* Box inner shadow */}
      <path d="M50 85 L100 110 L150 85" stroke="#E5E7EB" strokeWidth="1" />

      {/* Box inside dark area */}
      <path
        d="M55 75 L100 95 L145 75 L145 85 L100 105 L55 85 Z"
        fill="#1a1a1a"
      />

      {/* Decorative curved dashed line */}
      <path
        d="M115 50 Q 130 30 140 35 Q 155 42 150 25"
        stroke="#9CA3AF"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        fill="none"
      />

      {/* Small decorative element */}
      <circle cx="152" cy="22" r="4" fill="#8B5CF6" />
      <ellipse cx="152" cy="22" rx="2" ry="3" fill="#A78BFA" />
    </svg>
  );
}
