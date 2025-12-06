"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface CommunityTokenForm {
  name: string;
  symbol: string;
  decimals: string;
  minBalance: string;
  initialSupply: string;
  issuer: string;
  freezer: string;
  icon: string;
}

interface CommunityDraft {
  name: string;
  description: string;
  rules: string;
  allowInvestment: boolean;
  activityTypes: string[];
}

type ButtonState = "idle" | "processing" | "success" | "error";

export default function CommunityCoinsPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [issueCoins, setIssueCoins] = useState(false);
  const [configLocked, setConfigLocked] = useState(false);
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [communityDraft, setCommunityDraft] = useState<CommunityDraft | null>(null);
  const currentStep = 2;

  const [formData, setFormData] = useState<CommunityTokenForm>({
    name: "",
    symbol: "",
    decimals: "",
    minBalance: "",
    initialSupply: "",
    issuer: "",
    freezer: "",
    icon: "",
  });

  // Load community draft from localStorage on mount
  useEffect(() => {
    const storedDraft = localStorage.getItem("community-draft");
    if (storedDraft) {
      try {
        const parsed = JSON.parse(storedDraft);
        // Use a microtask to avoid synchronous setState in effect
        queueMicrotask(() => setCommunityDraft(parsed));
      } catch {
        // Invalid draft data, redirect back to step 1
        router.replace("/dashboard/community/create-community");
      }
    } else {
      // No draft found, redirect back to step 1
      router.replace("/dashboard/community/create-community");
    }
  }, [router]);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleInputChange = (
    field: keyof CommunityTokenForm,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validate symbol: 3-5 uppercase letters
  const isValidSymbol = (symbol: string) => {
    return /^[A-Z]{3,5}$/.test(symbol.toUpperCase());
  };

  // Check if form is valid (all required fields filled)
  const isFormValid = useMemo(() => {
    if (!issueCoins) return true; // No form validation needed when toggle is off

    const requiredFields = ["name", "symbol", "decimals", "minBalance", "initialSupply"];
    const allRequiredFilled = requiredFields.every(
      (field) => formData[field as keyof CommunityTokenForm].trim() !== ""
    );
    const symbolValid = isValidSymbol(formData.symbol);
    const decimalsValid = !isNaN(Number(formData.decimals)) && Number(formData.decimals) >= 0;

    return allRequiredFilled && symbolValid && decimalsValid;
  }, [issueCoins, formData]);

  const handleCreate = async () => {
    if (issueCoins && !isFormValid) return;
    if (!communityDraft) return;
    if (buttonState === "processing" || buttonState === "success") return;

    setButtonState("processing");
    setErrorMessage(null);

    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem("relay-auth-token");
      if (!authToken) {
        setButtonState("error");
        setErrorMessage("Not authenticated. Please log in again.");
        return;
      }

      // Build request payload
      const payload: {
        name: string;
        description: string;
        rules?: string;
        activityTypes: string[];
        allowInvestment: boolean;
        token?: {
          name: string;
          symbol: string;
          decimals: number;
          minBalance: string;
          initialSupply: string;
          issuer?: string;
          freezer?: string;
          icon?: string;
          configLocked?: boolean;
        };
      } = {
        name: communityDraft.name,
        description: communityDraft.description,
        rules: communityDraft.rules || undefined,
        activityTypes: communityDraft.activityTypes,
        allowInvestment: communityDraft.allowInvestment,
      };

      // Add token data if issuing coins
      if (issueCoins) {
        payload.token = {
          name: formData.name,
          symbol: formData.symbol.toUpperCase(),
          decimals: parseInt(formData.decimals, 10),
          minBalance: formData.minBalance,
          initialSupply: formData.initialSupply,
          issuer: formData.issuer || undefined,
          freezer: formData.freezer || undefined,
          icon: formData.icon || undefined,
          configLocked,
        };
      }

      // Call the API
      const response = await fetch("/api/community/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setButtonState("error");
        setErrorMessage(data.error || "Failed to create community");
        return;
      }

      // Success!
      setButtonState("success");
      
      // Clear the draft from localStorage
      localStorage.removeItem("community-draft");

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/dashboard/community");
      }, 1500);
    } catch (error) {
      console.error("Create community error:", error);
      setButtonState("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
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
        {/* Toggle Section */}
        <div className="flex items-center justify-between py-4 border-b border-gray-200">
          <span className="text-base text-black">Issue community coins?</span>
          <Switch
            checked={issueCoins}
            onCheckedChange={setIssueCoins}
          />
        </div>

        {/* Form Fields - Only shown when toggle is on */}
        {issueCoins && (
          <div className="flex flex-col">
            {/* Name */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Name of the coin"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Symbol (Ticker) */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">Ticker</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) =>
                  handleInputChange("symbol", e.target.value.toUpperCase().slice(0, 5))
                }
                placeholder="3-5 letters (e.g. BTC)"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Decimals */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">Decimals</label>
              <input
                type="number"
                min="0"
                max="18"
                value={formData.decimals}
                onChange={(e) => handleInputChange("decimals", e.target.value)}
                placeholder="Number of decimal places (e.g. 10)"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Minimum Balance */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">Minimum Balance</label>
              <input
                type="text"
                value={formData.minBalance}
                onChange={(e) => handleInputChange("minBalance", e.target.value)}
                placeholder="Minimum balance to hold the token"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Initial Supply */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">Initial Supply</label>
              <input
                type="text"
                value={formData.initialSupply}
                onChange={(e) => handleInputChange("initialSupply", e.target.value)}
                placeholder="Initial token supply amount"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Issuer (Optional) */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">
                Issuer Address <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.issuer}
                onChange={(e) => handleInputChange("issuer", e.target.value)}
                placeholder="Account that can mint new tokens"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Freezer (Optional) */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">
                Freezer Address <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.freezer}
                onChange={(e) => handleInputChange("freezer", e.target.value)}
                placeholder="Account that can freeze/thaw accounts"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Icon URL (Optional) */}
            <div className="py-4 border-b border-gray-200">
              <label className="block text-sm text-gray-500 mb-1">
                Icon URL <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => handleInputChange("icon", e.target.value)}
                placeholder="Link to token icon"
                className="w-full text-base text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>

            {/* Configuration Lock Checkbox */}
            <div className="flex items-center gap-3 py-6">
              <button
                type="button"
                onClick={() => setConfigLocked(!configLocked)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  configLocked
                    ? "border-violet-500 bg-violet-500"
                    : "border-gray-300 bg-white"
                }`}
              >
                {configLocked && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </button>
              <span className="text-base text-black">
                Configuration is not changeable
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="px-5 pb-2">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Bottom Button */}
      <div className="px-5 pb-8 pt-4">
        <Button
          onClick={handleCreate}
          disabled={(issueCoins && !isFormValid) || buttonState === "processing" || buttonState === "success"}
          className={`w-full h-14 rounded-2xl font-semibold text-base transition-all ${
            buttonState === "success"
              ? "bg-green-500 hover:bg-green-500 text-white"
              : buttonState === "processing"
              ? "bg-[#1a1a1a] text-white cursor-wait"
              : !issueCoins || isFormValid
              ? "bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {buttonState === "processing" ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </span>
          ) : buttonState === "success" ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-5 h-5" />
              Community Created!
            </span>
          ) : issueCoins ? (
            "Confirm"
          ) : (
            "Create Community"
          )}
        </Button>
      </div>
    </div>
  );
}
