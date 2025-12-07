"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SeedPhraseDisplay from "@/components/SeedPhraseDisplay";
import { WALLET_SEED_KEY } from "@/app/types/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChevronLeft } from "lucide-react";

export default function SeedPhrasePage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load seed phrase from localStorage
    const loadSeedPhrase = () => {
      if (typeof window === "undefined") {
        setIsLoading(false);
        return;
      }

      const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
      if (mnemonic) {
        setSeedPhrase(mnemonic.trim().split(/\s+/));
      }
      setIsLoading(false);
    };

    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(loadSeedPhrase, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Small delay to allow animation before navigating back
    setTimeout(() => {
      router.back();
    }, 200);
  };

  if (isLoading) {
    return null;
  }

  if (seedPhrase.length === 0) {
    return (
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left pb-4">
            <button
              onClick={handleClose}
              className="mb-4 -ml-2 p-2 cursor-pointer"
              aria-label="Go back"
            >
              <svg
                className="w-6 h-6"
                style={{ color: "#1a1a1a" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <SheetTitle className="text-3xl font-semibold tracking-tight text-left" style={{ color: "#1a1a1a" }}>
              View Seed Phrase
            </SheetTitle>
          </SheetHeader>
          <div className="py-8 text-center">
            <p className="text-gray-600">No seed phrase found. Please create or import a wallet first.</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left pb-6">
          {/* Back button */}
          <ChevronLeft onClick={handleClose} className="mb-4 -ml-2 p-2 cursor-pointer" />
          {/* Title */}
          <SheetTitle className="text-3xl font-semibold tracking-tight text-left" style={{ color: "#1a1a1a" }}>
            View Seed Phrase
          </SheetTitle>
        </SheetHeader>

        {/* Seed Phrase Display */}
        <div className="mb-8">
          <SeedPhraseDisplay words={seedPhrase} />
        </div>

        {/* Finish Button */}
        <button
          onClick={handleClose}
          className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer"
          style={{
            backgroundColor: "#1a1a1a",
          }}
        >
          <span className="text-white font-medium">Finish</span>
        </button>
      </SheetContent>
    </Sheet>
  );
}
