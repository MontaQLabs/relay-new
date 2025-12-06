"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CommunityCoinsPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const currentStep = 2; // Step 1: Basic Information, Step 2: Community Coins

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleCreate = () => {
    // TODO: Handle community creation
    console.log("Create community clicked");
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-white flex flex-col ${
        isExiting ? "animate-slide-out-right" : "animate-slide-in-right"
      }`}
    >
      {/* Header */}
      <header className="flex items-center px-4 py-4">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
      </header>

      {/* Progress Bar */}
      <div className="px-5 pb-4">
        <div className="flex gap-2">
          <div
            className={`h-1 flex-1 rounded-full ${
              currentStep >= 1 ? "bg-violet-500" : "bg-gray-200"
            }`}
          />
          <div
            className={`h-1 flex-1 rounded-full ${
              currentStep >= 2 ? "bg-violet-500" : "bg-gray-200"
            }`}
          />
        </div>
      </div>

      {/* Title */}
      <div className="px-5 pb-6">
        <h1 className="text-2xl font-bold text-black">Community Coins</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-auto px-5">
        <p className="text-gray-500">
          Configure your community coins settings here.
        </p>
      </div>

      {/* Bottom Button */}
      <div className="px-5 pb-8 pt-4">
        <Button
          onClick={handleCreate}
          className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base transition-all"
        >
          Create Community
        </Button>
      </div>
    </div>
  );
}
