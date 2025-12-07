"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { getAuthToken } from "@/app/utils/auth";
import type { Friend } from "@/app/types/frontend_type";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

interface EditFriendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  friend: Friend | null;
  onSuccess: () => void;
  onDeleted: () => void;
}

export default function EditFriendSheet({
  isOpen,
  onClose,
  friend,
  onSuccess,
  onDeleted,
}: EditFriendSheetProps) {
  const [nickname, setNickname] = useState("");
  const [network, setNetwork] = useState("");
  const [remark, setRemark] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form with friend data
  useEffect(() => {
    if (friend && isOpen) {
      setNickname(friend.nickname);
      setNetwork(friend.network);
      setRemark(friend.remark || "");
      setError("");
    }
  }, [friend, isOpen]);

  // Check if there are changes
  const hasChanges =
    friend &&
    (nickname !== friend.nickname ||
      network !== friend.network ||
      remark !== (friend.remark || ""));

  const handleSubmit = async () => {
    if (!friend || !hasChanges) return;

    setIsLoading(true);
    setError("");

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setError("Not authenticated. Please log in again.");
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `/api/friends/${encodeURIComponent(friend.walletAddress)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            nickname: nickname.trim(),
            network: network.trim(),
            remark: remark.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update friend");
      }

      onSuccess();
    } catch (error) {
      console.error("Failed to update friend:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update friend. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!friend) return;

    setIsDeleting(true);
    setError("");
    setShowDeleteConfirm(false);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setError("Not authenticated. Please log in again.");
        setIsDeleting(false);
        return;
      }

      const response = await fetch(
        `/api/friends/${encodeURIComponent(friend.walletAddress)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete friend");
      }

      onDeleted();
    } catch (error) {
      console.error("Failed to delete friend:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete friend. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isLoading && !isDeleting) {
      if (friend) {
        setNickname(friend.nickname);
        setNetwork(friend.network);
        setRemark(friend.remark || "");
      }
      setError("");
      onClose();
    }
  };

  if (!friend) return null;

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md px-6 pb-8 overflow-auto">
        <SheetHeader className="text-left pb-6">
          {/* Back button */}
          <button
            onClick={handleClose}
            className="mb-4 -ml-2 p-2 cursor-pointer"
            aria-label="Go back"
            disabled={isLoading || isDeleting}
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>

          {/* Title and Cancel button */}
          <div className="flex items-center justify-between">
            <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
              Edit Friend
            </SheetTitle>
            <button
              onClick={handleClose}
              disabled={isLoading || isDeleting}
              className="text-purple-600 font-medium hover:text-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </SheetHeader>

        {/* Form */}
        <div className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Username
            </label>
            <Input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="The username of your friend"
              className="w-full h-14 px-4 rounded-2xl border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-black"
              disabled={isLoading || isDeleting}
            />
          </div>

          {/* Network */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Network
            </label>
            <Input
              type="text"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              placeholder="Which network the friend is on"
              className="w-full h-14 px-4 rounded-2xl border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-black"
              disabled={isLoading || isDeleting}
            />
          </div>

          {/* Address (read-only) */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Address
            </label>
            <Input
              type="text"
              value={friend.walletAddress}
              readOnly
              className="w-full h-14 px-4 rounded-2xl border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
              disabled
            />
          </div>

          {/* Remark */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Remark
            </label>
            <Input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Notes about this friend"
              className="w-full h-14 px-4 rounded-2xl border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-black"
              disabled={isLoading || isDeleting}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            {/* Delete Button */}
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isLoading || isDeleting}
              className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 bg-red-50 text-red-600 hover:bg-red-100"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="font-medium">Delete Friend</span>
              )}
            </button>

            {/* Confirm Button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || isDeleting || !hasChanges}
              className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor:
                  isLoading || isDeleting || !hasChanges ? "#d1d1d6" : "#a855f7",
              }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <span className="text-white font-medium">Confirm</span>
              )}
            </button>
          </div>
        </div>
      </SheetContent>

      {/* Delete Confirmation Sheet */}
      <Sheet 
        open={showDeleteConfirm} 
        onOpenChange={(open) => {
          if (!isDeleting) {
            setShowDeleteConfirm(open);
          }
        }}
      >
        <SheetContent side="bottom" className="px-6 pb-8 pt-6" hideCloseButton>
          <SheetHeader className="text-left pb-6">
            <SheetTitle className="text-2xl font-semibold tracking-tight text-left text-black">
              Delete Friend
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* Warning Message */}
            <div className="flex items-start gap-3 text-gray-700">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-base font-medium text-black">
                  Are you sure you want to delete this friend?
                </p>
                <p className="text-sm text-gray-600">
                  This action cannot be undone. You will need to add this friend again if you want to restore them.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-3">
              {/* Delete Button */}
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 bg-red-500 text-white hover:bg-red-700"
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="font-medium">Delete</span>
                )}
              </button>

              {/* Cancel Button */}
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <span className="font-medium">Cancel</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Sheet>
  );
}
