"use client";

import { useState } from "react";
import { EyeOff, Copy, Check } from "lucide-react";

interface SeedPhraseDisplayProps {
  words: string[];
  onCopy?: () => void;
}

export default function SeedPhraseDisplay({ words, onCopy }: SeedPhraseDisplayProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleCopy = async () => {
    if (!isRevealed) return;
    
    try {
      await navigator.clipboard.writeText(words.join(" "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (error) {
      console.error("Failed to copy seed phrase:", error);
    }
  };

  return (
    <div className="w-full">
      {!isRevealed ? (
        // Hidden state with reveal button
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {/* Blurred words grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="h-12 rounded-xl bg-gray-200 blur-sm"
                style={{ backgroundColor: "#f5f5f5" }}
              />
            ))}
          </div>

          {/* Reveal button */}
          <button
            onClick={handleReveal}
            className="w-full flex flex-col items-center justify-center gap-2 py-4"
          >
            <EyeOff className="w-6 h-6 text-black" />
            <span className="text-base font-medium text-black">Reveal</span>
            <span className="text-sm text-gray-600">Make sure nobody is looking</span>
          </button>
        </div>
      ) : (
        // Revealed state with words
        <div className="w-full">
          {/* Words grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {words.map((word, index) => (
              <div
                key={index}
                className="relative h-12 rounded-xl border flex items-center px-3"
                style={{
                  backgroundColor: "#f5f5f5",
                  borderColor: "#d1d1d6",
                }}
              >
                <span
                  className="text-sm font-medium mr-2"
                  style={{ color: "#8e8e93" }}
                >
                  {index + 1}.
                </span>
                <span
                  className="text-base font-medium flex-1"
                  style={{ color: "#1a1a1a" }}
                >
                  {word}
                </span>
              </div>
            ))}
          </div>

          {/* Copy to clipboard link */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2 text-purple-600 hover:text-purple-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="text-sm font-medium">Copy to Clipboard</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
