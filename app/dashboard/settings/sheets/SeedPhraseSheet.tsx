"use client";

import { useState, useCallback, useMemo } from "react";
import { Check, AlertCircle, EyeOff, ChevronLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WALLET_SEED_KEY, IS_BACKED_UP_KEY } from "@/app/types/constants";

interface SeedPhraseSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type SeedPhraseStep = "reveal" | "verify1" | "verify2" | "error" | "success";

export function SeedPhraseSheet({ isOpen, onClose }: SeedPhraseSheetProps) {
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);
  const [step, setStep] = useState<SeedPhraseStep>("reveal");
  const [isRevealed, setIsRevealed] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [verificationFields, setVerificationFields] = useState<{ [key: number]: string }>({});
  const [activeField, setActiveField] = useState<number | null>(null);
  const [lastVerifyStep, setLastVerifyStep] = useState<"verify1" | "verify2">("verify1");

  // Compute available words based on current step and seed phrase
  const availableWords = useMemo(() => {
    if (seedPhrase.length === 0) return [];
    const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
    const wordsToFill = emptyFields.map((n) => seedPhrase[n - 1]);
    return [...new Set(wordsToFill)];
  }, [step, seedPhrase]);

  // Initialize seed phrase when sheet opens
  const initializeSeedPhrase = useCallback(() => {
    const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
    if (mnemonic) {
      const words = mnemonic.trim().split(/\s+/);
      setSeedPhrase(words);
    }
  }, []);

  // Handle sheet open change
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStep("reveal");
      setIsRevealed(false);
      setVerificationFields({});
      setActiveField(null);
      setLastVerifyStep("verify1");
      initializeSeedPhrase();
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem(IS_BACKED_UP_KEY, "true");
    handleOpenChange(false);
  };

  const handleReveal = () => setIsRevealed(true);

  const handleNextFromReveal = () => {
    if (isRevealed) {
      setStep("verify1");
      setActiveField(9);
      setVerificationFields({});
    }
  };

  const handleCopy = async () => {
    try {
      const phrase = seedPhrase.join(" ");
      await navigator.clipboard.writeText(phrase);
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleWordSelect = (word: string) => {
    if (activeField !== null) {
      setVerificationFields((prev) => ({ ...prev, [activeField]: word }));

      const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
      const currentIndex = emptyFields.indexOf(activeField);
      if (currentIndex < emptyFields.length - 1) {
        setActiveField(emptyFields[currentIndex + 1]);
      } else {
        setActiveField(null);
      }
    }
  };

  const handleVerify = () => {
    const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
    const allFilled = emptyFields.every((field) => verificationFields[field]);
    if (!allFilled) return;

    const isCorrect = emptyFields.every(
      (field) => verificationFields[field] === seedPhrase[field - 1]
    );

    if (isCorrect) {
      if (step === "verify1") {
        setLastVerifyStep("verify1");
        setStep("verify2");
        setActiveField(2);
        setVerificationFields({});
      } else if (step === "verify2") {
        setLastVerifyStep("verify2");
        setStep("success");
      }
    } else {
      setLastVerifyStep(step === "verify1" ? "verify1" : "verify2");
      setStep("error");
    }
  };

  const handleTryAgain = () => {
    setStep(lastVerifyStep);
    setVerificationFields({});
    const emptyFields = lastVerifyStep === "verify1" ? [9, 10, 12] : [2, 6, 11];
    setActiveField(emptyFields[0]);
  };

  const getStepNumber = () => {
    switch (step) {
      case "reveal": return 1;
      case "verify1": return 2;
      case "verify2": return 3;
      case "error": return lastVerifyStep === "verify1" ? 2 : 3;
      case "success": return 3;
      default: return 1;
    }
  };

  const renderProgressIndicator = () => {
    const currentStep = getStepNumber();
    return (
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= currentStep ? "bg-purple-600" : "bg-gray-200"}`}
          />
        ))}
      </div>
    );
  };

  const renderRevealStep = () => (
    <>
      <SheetHeader className="text-left pb-6">
        <button onClick={handleClose} className="mb-4 -ml-2 p-2 cursor-pointer">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        {renderProgressIndicator()}
        <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
          Export Seed Phrase
        </SheetTitle>
        <p className="text-sm text-gray-600 mt-2">
          If the seed phrase is lost, all of your assets would be lost. Please back it up in a secure place.
        </p>
      </SheetHeader>

      <div className="mb-4 flex flex-col justify-center">
        {!isRevealed ? (
          <div className="bg-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center">
            <button onClick={handleReveal} className="flex flex-col items-center gap-2 cursor-pointer">
              <EyeOff className="w-8 h-8 text-black" />
              <span className="text-base font-medium text-black">Click to Reveal</span>
              <span className="text-sm text-gray-600">Make sure nobody is looking</span>
            </button>
            <div className="mt-8 grid grid-cols-3 gap-3 w-full">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="h-12 rounded-xl bg-gray-200 blur-sm" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {seedPhrase.map((word, index) => (
              <div key={index} className="h-12 rounded-xl border flex items-center px-3 bg-gray-50 border-gray-200">
                <span className="text-sm font-medium mr-2 text-gray-500">{index + 1}.</span>
                <span className="text-base font-medium flex-1 text-black">{word}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 h-[52px] flex justify-center items-center">
        {isRevealed && (
          <button
            onClick={handleCopy}
            className={`font-medium text-sm transition-colors ${
              seedCopied ? "text-green-600" : "text-purple-600 hover:text-purple-700"
            }`}
          >
            {seedCopied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>

      <button
        onClick={handleNextFromReveal}
        disabled={!isRevealed}
        className="w-full h-14 rounded-full bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </>
  );

  const renderVerifyStep = () => {
    const emptyFields = step === "verify1" ? [9, 10, 12] : [2, 6, 11];
    const allFields = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
      <>
        <SheetHeader className="text-left pb-6">
          <button
            onClick={() => {
              if (step === "verify1") {
                setStep("reveal");
              } else {
                setStep("verify1");
                setActiveField(9);
                setVerificationFields({});
              }
            }}
            className="mb-4 -ml-2 p-2 cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          {renderProgressIndicator()}
          <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
            Verify
          </SheetTitle>
          <p className="text-sm text-gray-600 mt-2">Fill in the word in correct order.</p>
        </SheetHeader>

        <div className="mb-4 h-[300px] flex flex-col justify-center">
          <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-2xl p-4">
            {allFields.map((fieldNum) => {
              const isEmpty = emptyFields.includes(fieldNum);
              const isActive = activeField === fieldNum;
              const value = verificationFields[fieldNum] || "";

              return (
                <div
                  key={fieldNum}
                  className={`h-12 rounded-xl border flex items-center px-3 ${
                    isEmpty
                      ? isActive
                        ? "bg-white border-purple-600 border-2"
                        : "bg-white border-gray-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  onClick={() => isEmpty && setActiveField(fieldNum)}
                >
                  <span className="text-sm font-medium mr-2 text-gray-500">{fieldNum}.</span>
                  {isEmpty ? (
                    <input
                      type="text"
                      value={value}
                      readOnly
                      className="flex-1 text-base font-medium text-black bg-transparent outline-none cursor-pointer"
                    />
                  ) : (
                    <span className="text-base font-medium flex-1 text-black">• • • •</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-4 h-[52px] flex gap-3 justify-center flex-wrap items-center">
          {availableWords.map((word, index) => {
            const isUsed = Object.values(verificationFields).includes(word);
            return (
              <button
                key={index}
                onClick={() => !isUsed && activeField !== null && handleWordSelect(word)}
                disabled={isUsed || activeField === null}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  isUsed
                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-white border-purple-600 text-purple-600 hover:bg-purple-50"
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleVerify}
          disabled={!emptyFields.every((field) => verificationFields[field])}
          className="w-full h-14 rounded-full bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </>
    );
  };

  const renderErrorStep = () => (
    <>
      <SheetHeader className="text-left pb-6">
        <div className="mb-4 h-10" />
        {renderProgressIndicator()}
      </SheetHeader>

      <div className="h-[300px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h3 className="text-2xl font-semibold text-black mb-2">Incorrect Order</h3>
        <p className="text-gray-600">Please re-check your seed phrase and try again.</p>
      </div>

      <div className="mb-4 h-[52px]" />

      <button
        onClick={handleTryAgain}
        className="w-full h-14 rounded-full bg-black text-white font-medium hover:bg-gray-800"
      >
        Try Again
      </button>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <SheetHeader className="text-left pb-6">
        <div className="mb-4 h-10" />
        {renderProgressIndicator()}
      </SheetHeader>

      <div className="h-[300px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-purple-600" />
        </div>
        <h3 className="text-2xl font-semibold text-black mb-2">Perfect!</h3>
        <p className="text-gray-600">Do not share it with anyone.</p>
      </div>

      <div className="mb-4 h-[52px]" />

      <button
        onClick={handleClose}
        className="w-full h-14 rounded-full bg-purple-600 text-white font-medium hover:bg-purple-700"
      >
        Confirm
      </button>
    </>
  );

  if (seedPhrase.length === 0 && isOpen) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left pb-4">
            <button onClick={handleClose} className="mb-4 -ml-2 p-2 cursor-pointer">
              <ChevronLeft className="w-6 h-6 text-black" />
            </button>
            <SheetTitle className="text-3xl font-semibold tracking-tight text-left text-black">
              Export Seed Phrase
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
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
        {step === "reveal" && renderRevealStep()}
        {(step === "verify1" || step === "verify2") && renderVerifyStep()}
        {step === "error" && renderErrorStep()}
        {step === "success" && renderSuccessStep()}
      </SheetContent>
    </Sheet>
  );
}
