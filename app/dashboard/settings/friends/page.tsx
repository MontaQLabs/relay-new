"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, UserPlus, Loader2 } from "lucide-react";
import { getAuthToken } from "@/app/utils/auth";
import type { Friend } from "@/app/types/frontend_type";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import AddFriendSheet from "./AddFriendSheet";
import FriendDetailSheet from "./FriendDetailSheet";

export default function FriendsPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
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
  };

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

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

  // Generate avatar URL for friend
  const getFriendAvatar = (walletAddress: string) => {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(walletAddress)}`;
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (!address) return "";
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-white flex flex-col ${
          isExiting ? "animate-slide-out-right" : "animate-slide-in-right"
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 relative border-b border-gray-100">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold text-black">
            Your Friends
          </h1>
          <div className="w-10" />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : friends.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full px-5 py-12">
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <UserPlus className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-black mb-2">
                No Friends Yet
              </h2>
              <p className="text-sm text-gray-500 text-center mb-8">
                Add your first friend to get started
              </p>
            </div>
          ) : (
            // Friends list
            <div className="px-5 py-4">
              {friends.map((friend, index) => (
                <button
                  key={`${friend.walletAddress}-${index}`}
                  onClick={() => handleFriendClick(friend)}
                  className="w-full flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    <img
                      src={getFriendAvatar(friend.walletAddress)}
                      alt={friend.nickname}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.walletAddress}`;
                      }}
                    />
                  </div>

                  {/* Friend Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-black truncate">
                      {friend.nickname}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {truncateAddress(friend.walletAddress)}
                    </p>
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
      </div>

      {/* Add Friend Sheet */}
      <AddFriendSheet
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        onSuccess={handleAddFriendSuccess}
      />

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
