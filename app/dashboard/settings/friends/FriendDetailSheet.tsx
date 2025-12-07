"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Friend } from "@/app/types/frontend_type";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import EditFriendSheet from "./EditFriendSheet";

interface FriendDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  friend: Friend | null;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function FriendDetailSheet({
  isOpen,
  onClose,
  friend,
  onUpdated,
  onDeleted,
}: FriendDetailSheetProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (!friend) return null;

  const handleEdit = () => {
    setIsEditOpen(true);
  };

  const handleEditClose = () => {
    setIsEditOpen(false);
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    onUpdated();
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (!address) return "";
    return address.length > 40
      ? `${address.slice(0, 20)}...${address.slice(-20)}`
      : address;
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-md px-6 pb-8 overflow-auto">
          <SheetHeader className="text-left pb-6">
            {/* Back button */}
            <button
              onClick={onClose}
              className="mb-4 -ml-2 p-2 cursor-pointer"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-black" />
            </button>

            {/* Title and Edit button */}
            <div className="flex items-center justify-between">
              <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
                Friend Information
              </SheetTitle>
              <button
                onClick={handleEdit}
                className="text-purple-600 font-medium hover:text-purple-700 transition-colors"
              >
                Edit
              </button>
            </div>
          </SheetHeader>

          {/* Friend Details */}
          <div className="space-y-0">
            {/* Username */}
            <div className="py-4 border-b border-gray-100">
              <label className="block text-sm text-gray-500 mb-1">Username</label>
              <p className="text-base font-medium text-black">{friend.nickname}</p>
            </div>

            {/* Network */}
            <div className="py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm text-gray-500 mb-1">Network</label>
                  <p className="text-base font-medium text-black">{friend.network}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            {/* Address */}
            <div className="py-4 border-b border-gray-100">
              <label className="block text-sm text-gray-500 mb-1">Address</label>
              <p className="text-base font-medium text-black break-all">
                {truncateAddress(friend.walletAddress)}
              </p>
            </div>

            {/* Remark */}
            <div className="py-4 border-b border-gray-100">
              <label className="block text-sm text-gray-500 mb-1">Remark</label>
              <p className="text-base font-medium text-black">
                {friend.remark || "No remark"}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Friend Sheet */}
      <EditFriendSheet
        isOpen={isEditOpen}
        onClose={handleEditClose}
        friend={friend}
        onSuccess={handleEditSuccess}
        onDeleted={onDeleted}
      />
    </>
  );
}
