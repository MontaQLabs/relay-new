"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importWallet, isCreated } from "../../../utils/wallet";

export default function ImportWalletPage() {
  const router = useRouter();
  const [words, setWords] = useState<string[]>(Array(12).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if all 12 words are filled
  const allWordsFilled = words.every((word) => word.trim() !== "");

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    // Remove any spaces and convert to lowercase
    newWords[index] = value.toLowerCase().replace(/\s/g, "");
    setWords(newWords);
    setError(null);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData("text");
    const pastedWords = pastedText.trim().toLowerCase().split(/\s+/);

    // If pasting multiple words, distribute them across the inputs
    if (pastedWords.length > 1) {
      e.preventDefault();
      const newWords = [...words];
      pastedWords.forEach((word, i) => {
        if (index + i < 12) {
          newWords[index + i] = word;
        }
      });
      setWords(newWords);
      setError(null);
    }
  };

  const handleNext = async () => {
    if (!allWordsFilled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Join words with spaces to create the seed phrase
      const seedPhrase = words.join(" ");
      await importWallet(seedPhrase);

      // Verify wallet was imported successfully
      if (isCreated()) {
        router.push("/create-password");
      } else {
        setError("Failed to import wallet. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Failed to import wallet:", err);
      setError(err instanceof Error ? err.message : "Invalid seed phrase. Please check your words.");
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/welcome");
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="pt-12 px-6 pb-6">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="mb-6 -ml-2 p-2 cursor-pointer"
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

        <h1
          className="text-3xl font-semibold tracking-tight animate-fade-in"
          style={{ color: "#1a1a1a" }}
        >
          Import Wallet
        </h1>
        <p
          className="text-base mt-2 animate-slide-up"
          style={{ color: "#8e8e93" }}
        >
          Enter your 12-word recovery phrase
        </p>
      </div>

      {/* Seed phrase inputs */}
      <div className="px-6 py-2 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3 animate-slide-up animation-delay-100">
          {words.map((word, index) => (
            <div key={index} className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: "#8e8e93" }}
              >
                {index + 1}.
              </span>
              <input
                type="text"
                value={word}
                onChange={(e) => handleWordChange(index, e.target.value)}
                onPaste={(e) => handlePaste(e, index)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full h-12 pl-9 pr-3 rounded-xl border text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                style={{
                  backgroundColor: "#f5f5f5",
                  borderColor: word ? "#d1d1d6" : "#e5e5e5",
                  color: "#1a1a1a",
                }}
              />
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 rounded-xl animate-fade-in" style={{ backgroundColor: "#fef2f2" }}>
            <p className="text-sm" style={{ color: "#dc2626" }}>
              {error}
            </p>
          </div>
        )}

        {/* Help text */}
        <div className="mt-6 animate-slide-up animation-delay-200">
          <p className="text-sm" style={{ color: "#8e8e93" }}>
            You can paste your entire recovery phrase at once. Make sure to enter the words in the correct order.
          </p>
        </div>
      </div>

      {/* Next button */}
      <div className="px-6 pb-10 pt-6">
        <button
          onClick={handleNext}
          disabled={!allWordsFilled || isLoading}
          className="w-full h-14 rounded-full flex items-center justify-center transition-all duration-200 animate-slide-up animation-delay-300 cursor-pointer disabled:cursor-not-allowed"
          style={{
            backgroundColor: allWordsFilled ? "#1a1a1a" : "#d1d1d6",
          }}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-white font-medium">Importing...</span>
            </div>
          ) : (
            <span className="text-white font-medium">Next</span>
          )}
        </button>
      </div>
    </div>
  );
}
