"use client";

import { useState } from "react";
import { ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { getAuthToken } from "@/app/utils/auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

interface AddFriendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddFriendSheet({ isOpen, onClose, onSuccess }: AddFriendSheetProps) {
  const [nickname, setNickname] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [remark, setRemark] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    // Validate
    if (!nickname.trim() || !walletAddress.trim() || !network.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setError("Not authenticated. Please log in again.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          walletAddress: walletAddress.trim(),
          network: network.trim(),
          remark: remark.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add friend");
      }

      // Reset form
      setNickname("");
      setWalletAddress("");
      setNetwork("");
      setRemark("");
      setError("");

      // Call success callback
      onSuccess();
    } catch (error) {
      console.error("Failed to add friend:", error);
      setError(error instanceof Error ? error.message : "Failed to add friend. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setNickname("");
      setWalletAddress("");
      setNetwork("");
      setRemark("");
      setError("");
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md px-6 pb-8 overflow-auto">
        <SheetHeader className="text-left pb-6">
          {/* Back button */}
          <button
            onClick={handleClose}
            className="mb-4 -ml-2 p-2 cursor-pointer"
            aria-label="Go back"
            disabled={isLoading}
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>

          {/* Title */}
          <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
            Add New Friend
          </SheetTitle>
        </SheetHeader>

        {/* Form */}
        <div className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">Username</label>
            <Input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="The username of your friend"
              className="w-full h-14 px-4 rounded-2xl border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-black"
              disabled={isLoading}
            />
          </div>

          {/* Network */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">Network</label>
            <Input
              type="text"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              placeholder="Which network the friend is on"
              className="w-full h-14 px-4 rounded-2xl border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-black"
              disabled={isLoading}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">Address</label>
            <Input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="The public key of your friend"
              className="w-full h-14 px-4 rounded-2xl border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-black"
              disabled={isLoading}
            />
          </div>

          {/* Remark */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">Remark</label>
            <Input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Notes about this friend"
              className="w-full h-14 px-4 rounded-2xl border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-black"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !nickname.trim() || !walletAddress.trim() || !network.trim()}
              className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor:
                  isLoading || !nickname.trim() || !walletAddress.trim() || !network.trim()
                    ? "#d1d1d6"
                    : "#a855f7",
              }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <span className="text-white font-medium">Add Friend</span>
              )}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
