"use client";

import { useState } from "react";
import { LogOut, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface LogoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => Promise<void>;
  onDeleteWallet: () => Promise<void>;
}

export function LogoutSheet({
  isOpen,
  onClose,
  onConfirmLogout,
  onDeleteWallet,
}: LogoutSheetProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<"logout" | "delete" | null>(null);

  const handleConfirmLogout = async () => {
    setIsProcessing(true);
    setProcessingAction("logout");
    await onConfirmLogout();
    setIsProcessing(false);
    setProcessingAction(null);
    onClose();
  };

  const handleDeleteWallet = async () => {
    setIsProcessing(true);
    setProcessingAction("delete");
    await onDeleteWallet();
    setIsProcessing(false);
    setProcessingAction(null);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8">
        <SheetHeader className="text-center pb-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-8 h-8 text-red-500" />
          </div>
          <SheetTitle className="text-2xl font-bold text-black">Leaving?</SheetTitle>
          <SheetDescription className="text-gray-600">
            Choose how you want to sign out
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {/* Confirm Logout Button */}
          <button
            onClick={handleConfirmLogout}
            disabled={isProcessing}
            className="w-full py-4 px-5 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-black">Confirm Logout</p>
                <p className="text-sm text-gray-500">Keep wallet for next login</p>
              </div>
            </div>
            {processingAction === "logout" ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {/* Delete Wallet Button */}
          <button
            onClick={handleDeleteWallet}
            disabled={isProcessing}
            className="w-full py-4 px-5 bg-red-50 hover:bg-red-100 rounded-2xl transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-red-600">Delete Wallet</p>
                <p className="text-sm text-red-400">Remove all local data</p>
              </div>
            </div>
            {processingAction === "delete" ? (
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-red-400" />
            )}
          </button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="w-full mt-4 py-3 text-gray-600 font-medium hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </SheetContent>
    </Sheet>
  );
}
