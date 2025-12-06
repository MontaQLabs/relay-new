"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const MAX_DESCRIPTION_LENGTH = 144;
const MAX_RULES_LENGTH = 144;

export default function CreateCommunityPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const currentStep = 1; // Step 1: Basic Information, Step 2: Community Coins

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [allowInvestment, setAllowInvestment] = useState(true);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleDescriptionChange = (value: string) => {
    if (value.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(value);
    }
  };

  const handleRulesChange = (value: string) => {
    if (value.length <= MAX_RULES_LENGTH) {
      setRules(value);
    }
  };

  const handleTypeClick = () => {
    // TODO: Navigate to type selection page or open modal
    console.log("Type selection clicked");
  };

  const isFormValid = () => {
    // Name is required, description should have at least 10 words
    const hasName = name.trim().length > 0;
    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
    const hasEnoughWords = wordCount >= 10;
    return hasName && hasEnoughWords;
  };

  const handleNext = () => {
    if (isFormValid()) {
      // TODO: Navigate to next step or submit
      console.log("Next clicked", { name, description, rules, allowInvestment });
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
        <h1 className="text-2xl font-bold text-black">Basic Information</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Name Field */}
        <div className="px-5 py-4 border-t border-gray-100">
          <label className="text-sm font-medium text-black block mb-2">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter the name of your community"
            className="border-none bg-transparent p-0 h-auto text-base text-gray-400 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Description Field */}
        <div className="px-5 py-4 border-t border-gray-100">
          <label className="text-sm font-medium text-black block mb-2">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Describe your community with at least 10 words"
            className="border-none bg-transparent p-0 min-h-[60px] resize-none text-base text-gray-400 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="text-right mt-2">
            <span className="text-sm text-muted-foreground">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>
        </div>

        {/* Rules Field */}
        <div className="px-5 py-4 border-t border-gray-100">
          <label className="text-sm font-medium text-black block mb-2">
            Rules
          </label>
          <Textarea
            value={rules}
            onChange={(e) => handleRulesChange(e.target.value)}
            placeholder="The rules your community members should adhere to"
            className="border-none bg-transparent p-0 min-h-[60px] resize-none text-base text-gray-400 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="text-right mt-2">
            <span className="text-sm text-muted-foreground">
              {rules.length}/{MAX_RULES_LENGTH}
            </span>
          </div>
        </div>

        {/* Type Field */}
        <button
          onClick={handleTypeClick}
          className="flex items-center justify-between px-5 py-4 border-t border-gray-100 hover:bg-gray-50 transition-colors text-left"
        >
          <div>
            <label className="text-sm font-medium text-black block mb-1 pointer-events-none">
              Type
            </label>
            <span className="text-base text-gray-400">
              Setup allowed activity types
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        {/* Allow Investment Toggle */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-sm font-medium text-black">
            Allow investment?
          </span>
          <Switch
            checked={allowInvestment}
            onCheckedChange={setAllowInvestment}
            disabled
          />
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-5 pb-8 pt-4">
        <Button
          onClick={handleNext}
          disabled={!isFormValid()}
          className="w-full h-14 rounded-2xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
