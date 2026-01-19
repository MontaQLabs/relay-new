"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { getAuthToken } from "@/app/utils/auth";
import type { Friend } from "@/app/types/frontend_type";
import { PageHeader } from "@/components/layout/PageHeader";
import { SlideInPage } from "@/components/layout/SlideInPage";
import { useSlideNavigation } from "@/hooks";
import { truncateAddress } from "@/lib/format";
import { getDiceBearAvatar } from "@/lib/avatar";
import AddFriendSheet from "./AddFriendSheet";
import FriendDetailSheet from "./FriendDetailSheet";

export default function FriendsPage() {
  const router = useRouter();
  const { isExiting, handleBack } = useSlideNavigation();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchFriends = useCallback(async () => {
    try {
      setIsLoading(true);
      const authToken = getAuthToken();
      if (!authToken) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/friends", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch friends");
      }

      const data = await response.json();
      setFriends(data.friends || []);
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleFriendClick = (friend: Friend) => {
    setSelectedFriend(friend);
    setIsDetailOpen(true);
  };

  const handleAddFriendSuccess = () => {
    setIsAddFriendOpen(false);
    fetchFriends();
  };

  const handleFriendUpdated = () => {
    setIsDetailOpen(false);
    setSelectedFriend(null);
    fetchFriends();
  };

  const handleFriendDeleted = () => {
    setIsDetailOpen(false);
    setSelectedFriend(null);
    fetchFriends();
  };

  return (
    <>
      <SlideInPage isExiting={isExiting}>
        <PageHeader title="Your Friends" onBack={handleBack} className="border-b border-gray-100" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-5 py-12">
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <UserPlus className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-black mb-2">No Friends Yet</h2>
              <p className="text-sm text-gray-500 text-center mb-8">Add your first friend to get started</p>
            </div>
          ) : (
            <div className="px-5 py-4">
              {friends.map((friend, index) => (
                <button
                  key={`${friend.walletAddress}-${index}`}
                  onClick={() => handleFriendClick(friend)}
                  className="w-full flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getDiceBearAvatar(friend.walletAddress)}
                      alt={friend.nickname}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-black truncate">{friend.nickname}</h3>
                    <p className="text-sm text-gray-500 truncate">{truncateAddress(friend.walletAddress)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Friend Button */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => setIsAddFriendOpen(true)}
            className="w-full h-14 rounded-full bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add New Friend</span>
          </button>
        </div>
      </SlideInPage>

      {/* Add Friend Sheet */}
      <AddFriendSheet isOpen={isAddFriendOpen} onClose={() => setIsAddFriendOpen(false)} onSuccess={handleAddFriendSuccess} />

      {/* Friend Detail Sheet */}
      <FriendDetailSheet
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedFriend(null);
        }}
        friend={selectedFriend}
        onUpdated={handleFriendUpdated}
        onDeleted={handleFriendDeleted}
      />
    </>
  );
}
