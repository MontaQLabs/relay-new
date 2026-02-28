"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { encryptWallet } from "@/app/utils/wallet";
import { validate } from "@/app/utils/password";
import { WALLET_KEY } from "@/app/types/constants";
import type { Wallet } from "@/app/types/frontend_type";

interface ChangePasswordSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordSheet({ isOpen, onClose }: ChangePasswordSheetProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password validation
  const isPasswordValid = validate(password);
  const doPasswordsMatch = password === confirmPassword;
  const canSubmit = isPasswordValid && doPasswordsMatch && acknowledged;

  const handleConfirm = async () => {
    if (!canSubmit) return;

    setIsLoading(true);
    try {
      // Get the wallet from localStorage
      const walletData = localStorage.getItem(WALLET_KEY);
      if (!walletData) {
        throw new Error("Wallet not found");
      }
      const wallet = JSON.parse(walletData) as Wallet;

      // Encrypt the wallet with the password
      const success = await encryptWallet(wallet, password);

      if (success) {
        // Navigate to login page on success
        router.push("/login");
      } else {
        throw new Error("Failed to encrypt wallet");
      }
    } catch (error) {
      console.error("Failed to set password:", error);
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[85vh] flex flex-col">
        <SheetHeader className="text-left pb-4 flex-shrink-0">
          {/* Drag indicator */}
          <div className="flex justify-center pt-2 pb-4">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Title */}
          <SheetTitle className="text-2xl font-bold tracking-tight text-left text-black">
            Change Password
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500 mt-1">
            Only for this device
          </SheetDescription>
        </SheetHeader>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Create Password field */}
          <div>
            <label className="block text-sm font-medium mb-2 text-[#1a1a1a]">Create Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-14 px-4 pr-12 rounded-2xl border bg-white border-gray-200 text-[#1a1a1a] text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 cursor-pointer text-gray-400"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password field */}
          <div>
            <label className="block text-sm font-medium mb-2 text-[#1a1a1a]">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full h-14 px-4 pr-12 rounded-2xl border bg-white border-gray-200 text-[#1a1a1a] text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 cursor-pointer text-gray-400"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Acknowledgment checkbox */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setAcknowledged(!acknowledged)}
              className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer ${
                acknowledged ? "border-[#1a1a1a] bg-[#1a1a1a]" : "border-gray-300 bg-transparent"
              }`}
            >
              {acknowledged && (
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <p className="text-sm leading-relaxed text-[#1a1a1a]">
              We don&apos;t store your password, so we cannot recover it if you lose it
            </p>
          </div>
        </div>

        {/* Confirm button */}
        <div className="pt-6 flex-shrink-0">
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isLoading}
            className={`w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${
              canSubmit ? "bg-[#1a1a1a]" : "bg-gray-300"
            }`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="text-white font-medium">Confirm</span>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
