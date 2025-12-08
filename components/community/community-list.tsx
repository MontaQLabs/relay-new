"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Community } from "@/app/types/frontend_type";
import { SwipeableCommunityItem } from "./swipeable-community-item";
import { joinCommunity, getCommunityMembers } from "@/app/db/supabase";

export interface CommunityListProps {
  communities: Community[];
  currentUserWallet?: string;
  showJoinButton?: boolean;
  onJoinSuccess?: () => void;
}

export function CommunityList({ 
  communities, 
  currentUserWallet,
  showJoinButton = false,
  onJoinSuccess,
}: CommunityListProps) {
  const router = useRouter();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [membershipMap, setMembershipMap] = useState<Record<string, boolean>>({});
  const [loadingMembership, setLoadingMembership] = useState(false);

  // Check membership status for all communities when showing join button
  useEffect(() => {
    if (!showJoinButton || !currentUserWallet || communities.length === 0) return;

    const checkMembership = async () => {
      setLoadingMembership(true);
      const newMembershipMap: Record<string, boolean> = {};
      
      await Promise.all(
        communities.map(async (community) => {
          try {
            const members = await getCommunityMembers(community.communityId);
            const isMember = members.some(
              (m) => m.toLowerCase() === currentUserWallet.toLowerCase()
            );
            newMembershipMap[community.communityId] = isMember;
          } catch (error) {
            console.error(`Failed to check membership for ${community.communityId}:`, error);
            newMembershipMap[community.communityId] = false;
          }
        })
      );
      
      setMembershipMap(newMembershipMap);
      setLoadingMembership(false);
    };

    checkMembership();
  }, [communities, currentUserWallet, showJoinButton]);

  const handleCommunityClick = (communityId: string) => {
    router.push(`/dashboard/community/${communityId}`);
  };

  const handleJoin = async (communityId: string) => {
    if (!currentUserWallet) return;
    
    setJoiningId(communityId);
    try {
      const success = await joinCommunity(communityId, currentUserWallet);
      if (success) {
        // Update local membership map
        setMembershipMap((prev) => ({ ...prev, [communityId]: true }));
        // Notify parent of successful join
        onJoinSuccess?.();
      } else {
        console.error("Failed to join community");
      }
    } catch (error) {
      console.error("Error joining community:", error);
    } finally {
      setJoiningId(null);
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
          isJoining={joiningId === community.communityId}
          showJoinButton={showJoinButton}
          isMember={membershipMap[community.communityId] || false}
        />
      ))}
    </div>
  );
}

