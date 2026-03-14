"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Community } from "@/app/types/frontend_type";
import { SwipeableCommunityItem } from "./swipeable-community-item";
import { getAuthToken } from "@/app/utils/auth";

export interface CommunityListProps {
  communities: Community[];
  currentUserWallet?: string;
  showJoinButton?: boolean;
  onJoinSuccess?: () => void;
  onLeaveSuccess?: () => void;
}

export function CommunityList({
  communities,
  currentUserWallet,
  showJoinButton = false,
  onJoinSuccess,
  onLeaveSuccess,
}: CommunityListProps) {
  const router = useRouter();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [membershipMap, setMembershipMap] = useState<Record<string, boolean>>({});
  const [loadingMembership, setLoadingMembership] = useState(false);

  // Check membership status for all communities when showing join button
  useEffect(() => {
    if (!showJoinButton || !currentUserWallet || communities.length === 0) return;

    const checkMembership = async () => {
      setLoadingMembership(true);

      try {
        const communityIds = communities.map((c) => c.communityId).join(",");
        const response = await fetch(
          `/api/community/members?communityIds=${encodeURIComponent(communityIds)}&wallet=${encodeURIComponent(currentUserWallet)}`
        );

        if (response.ok) {
          const data = await response.json();
          setMembershipMap(data.membership || {});
        } else {
          console.error("Failed to check membership");
          // Set all to false on error
          const emptyMap: Record<string, boolean> = {};
          communities.forEach((c) => {
            emptyMap[c.communityId] = false;
          });
          setMembershipMap(emptyMap);
        }
      } catch (error) {
        console.error("Failed to check membership:", error);
      } finally {
        setLoadingMembership(false);
      }
    };

    checkMembership();
  }, [communities, currentUserWallet, showJoinButton]);

  const handleCommunityClick = (communityId: string) => {
    router.push(`/dashboard/community/${communityId}`);
  };

  const handleJoin = async (communityId: string) => {
    if (!currentUserWallet) return;

    const token = getAuthToken();
    if (!token) {
      console.error("No auth token available");
      return;
    }

    setJoiningId(communityId);
    try {
      const response = await fetch("/api/community/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ communityId }),
      });

      if (response.ok) {
        // Update local membership map
        setMembershipMap((prev) => ({ ...prev, [communityId]: true }));
        // Notify parent of successful join
        onJoinSuccess?.();
      } else {
        const error = await response.json();
        console.error("Failed to join community:", error.error);
      }
    } catch (error) {
      console.error("Error joining community:", error);
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (communityId: string) => {
    if (!currentUserWallet) return;

    const token = getAuthToken();
    if (!token) {
      console.error("No auth token available");
      return;
    }

    setLeavingId(communityId);
    try {
      const response = await fetch("/api/community/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ communityId }),
      });

      if (response.ok) {
        // Update local membership map
        setMembershipMap((prev) => ({ ...prev, [communityId]: false }));
        // Notify parent of successful leave
        onLeaveSuccess?.();
      } else {
        const error = await response.json();
        console.error("Failed to leave community:", error.error);
      }
    } catch (error) {
      console.error("Error leaving community:", error);
    } finally {
      setLeavingId(null);
    }
  };

  if (loadingMembership && showJoinButton) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {communities.map((community) => (
        <SwipeableCommunityItem
          key={community.communityId}
          community={community}
          onClick={() => handleCommunityClick(community.communityId)}
          currentUserWallet={currentUserWallet}
          onJoin={handleJoin}
          onLeave={handleLeave}
          isJoining={joiningId === community.communityId}
          isLeaving={leavingId === community.communityId}
          showJoinButton={showJoinButton}
          isMember={membershipMap[community.communityId] || false}
        />
      ))}
    </div>
  );
}
