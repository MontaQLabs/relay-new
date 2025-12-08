"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Community } from "@/app/types/frontend_type";

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
export const getAvatarColor = (communityId: string): string => {
  let hash = 0;
  for (let i = 0; i < communityId.length; i++) {
    hash = communityId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Generate a random avatar URL using DiceBear
export const getRandomAvatar = (communityId: string): string => {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${communityId}`;
};

export interface SwipeableCommunityItemProps {
  community: Community;
  onClick: () => void;
  currentUserWallet?: string;
  onJoin?: (communityId: string) => Promise<void>;
  isJoining?: boolean;
  showJoinButton?: boolean;
  isMember?: boolean;
}

export function SwipeableCommunityItem({
  community,
  onClick,
  currentUserWallet,
  onJoin,
  isJoining = false,
  showJoinButton = false,
  isMember = false,
}: SwipeableCommunityItemProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80; // Width of the quit button
  const CLICK_THRESHOLD = 5; // Minimum movement to consider as swipe

  // Check if current user is the creator
  const isCreator = currentUserWallet && 
    community.owner.toLowerCase() === currentUserWallet.toLowerCase();

  // Determine if we should show the swipe action (only for members, not creators)
  const showSwipeAction = isMember && !isCreator;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!showSwipeAction) return;
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
    setHasMoved(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !showSwipeAction) return;
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
    if (!showSwipeAction) {
      // If no swipe action, just mark for potential click
      setHasMoved(false);
      return;
    }
    startXRef.current = e.clientX;
    setIsDragging(true);
    setHasMoved(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !showSwipeAction) return;
    const diff = startXRef.current - e.clientX;
    
    if (Math.abs(diff) > CLICK_THRESHOLD) {
      setHasMoved(true);
    }
    
    const newOffset = Math.min(Math.max(0, diff), SWIPE_THRESHOLD);
    setSwipeOffset(newOffset);
  };

  const handleMouseUp = () => {
    if (!showSwipeAction) {
      // Direct click for non-swipeable items
      if (!hasMoved) {
        onClick();
      }
      return;
    }
    
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

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoin) {
      await onJoin(community.communityId);
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
      {/* Quit Button (behind the main content) - only for members */}
      {showSwipeAction && (
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
      )}

      {/* Main Content (slides over the quit button) */}
      <div
        className="relative bg-white flex items-center gap-4 px-5 py-4 cursor-pointer transition-transform hover:bg-gray-50"
        style={{
          transform: showSwipeAction ? `translateX(-${swipeOffset}px)` : undefined,
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
            {community.memberCount !== undefined 
              ? `${community.memberCount} member${community.memberCount !== 1 ? 's' : ''}`
              : `ID: ${displayId}`}
          </p>
        </div>

        {/* Join Button - only show for non-creators who aren't members */}
        {showJoinButton && !isCreator && !isMember && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleJoinClick}
            disabled={isJoining}
            className="flex-shrink-0 border-violet-500 text-violet-500 hover:bg-violet-50"
          >
            {isJoining ? (
              <div className="w-4 h-4 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            ) : (
              "Join"
            )}
          </Button>
        )}

        {/* Show "Joined" badge for members */}
        {showJoinButton && isMember && !isCreator && (
          <span className="flex-shrink-0 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            Joined
          </span>
        )}

        {/* Show "Creator" badge for owners */}
        {showJoinButton && isCreator && (
          <span className="flex-shrink-0 text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
            Mine
          </span>
        )}
      </div>
    </div>
  );
}

