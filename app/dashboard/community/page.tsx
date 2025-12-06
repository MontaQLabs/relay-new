"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { authenticateWithWallet, isAuthenticated } from "@/app/utils/auth";

// Types for community data
interface Community {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  imageUrl?: string;
}

type TabType = "joined" | "created";

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
  useEffect(() => {
    if (isAuthenticating) return;

    const fetchCommunities = async () => {
      setIsLoading(true);
      try {
        // TODO: Replace with actual API calls to fetch communities
        // For now, we'll simulate empty communities
        setJoinedCommunities([]);
        setCreatedCommunities([]);
      } catch (error) {
        console.error("Failed to fetch communities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommunities();
  }, [isAuthenticating]);

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

// Community List Component
function CommunityList({ communities }: { communities: Community[] }) {
  return (
    <div className="divide-y divide-gray-100">
      {communities.map((community) => (
        <div
          key={community.id}
          className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center overflow-hidden">
            {community.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={community.imageUrl}
                alt={community.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-violet-600 font-semibold text-lg">
                {community.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-black truncate">
              {community.name}
            </h4>
            <p className="text-sm text-muted-foreground">
              {community.memberCount} members
            </p>
          </div>
        </div>
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
