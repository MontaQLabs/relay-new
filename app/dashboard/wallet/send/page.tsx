"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function SendPage() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handlePasteOrClear = async () => {
    if (address) {
      // Clear the input
      setAddress("");
    } else {
      // Paste from clipboard
      try {
        const text = await navigator.clipboard.readText();
        setAddress(text);
      } catch (error) {
        console.error("Failed to read clipboard:", error);
      }
    }
  };

  const handleNext = () => {
    if (address.trim()) {
      // Navigate to next step with the address
      // For now, we'll just log it
      console.log("Proceeding with address:", address);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-white flex flex-col ${
        isExiting ? "animate-slide-out-right" : "animate-slide-in-right"
      }`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 relative">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold text-black">
          Send
        </h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-4">
        {/* Address Input Card */}
        <div className="bg-gray-50 rounded-2xl overflow-hidden">
          <Textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter the address of the recipient here"
            className="min-h-[140px] bg-transparent border-none resize-none text-black placeholder:text-gray-400 text-base p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="border-t border-gray-200">
            <button
              onClick={handlePasteOrClear}
              className="w-full py-3 text-violet-500 font-medium text-base hover:bg-gray-100 transition-colors"
            >
              {address ? "Clear" : "Paste"}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-5 pb-8 pt-4">
        <Button
          onClick={handleNext}
          disabled={!address.trim()}
          className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
