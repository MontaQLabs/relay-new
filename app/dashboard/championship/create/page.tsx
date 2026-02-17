"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks";
import { getAuthToken } from "@/app/utils/auth";
import { dotToPlanck } from "@/lib/format";

const SUPPORTED_CHAINS = [
  { id: "solana", name: "Solana", ticker: "SOL" },
  { id: "base", name: "Base", ticker: "ETH" },
  { id: "polkadot", name: "Polkadot Asset Hub", ticker: "DOT" },
  { id: "monad", name: "Monad", ticker: "MON" },
  { id: "near", name: "NEAR", ticker: "NEAR" },
];

const DURATION_PRESETS = [
  { label: "24 hours", seconds: 86400 },
  { label: "48 hours", seconds: 172800 },
  { label: "72 hours", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
];

const REFUND_PRESETS = [
  { label: "30 minutes", seconds: 1800 },
  { label: "1 hour", seconds: 3600 },
  { label: "2 hours", seconds: 7200 },
  { label: "6 hours", seconds: 21600 },
];

export default function CreateChallengePage() {
  const router = useRouter();
  const { isAuthenticating } = useAuth();

  const [title, setTitle] = useState("");
  const [abstractDescription, setAbstractDescription] = useState("");
  const [fullChallenge, setFullChallenge] = useState("");
  const [categories, setCategories] = useState("");
  const [chainId, setChainId] = useState("solana");
  const [entryFee, setEntryFee] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [judgeEnd, setJudgeEnd] = useState("");
  const [competitionDuration, setCompetitionDuration] = useState(259200);
  const [refundWindow, setRefundWindow] = useState(3600);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChain = SUPPORTED_CHAINS.find((c) => c.id === chainId)!;

  const handleSubmit = async () => {
    setError(null);

    if (!title.trim()) { setError("Title is required"); return; }
    if (!abstractDescription.trim()) { setError("Abstract description is required"); return; }
    if (!fullChallenge.trim()) { setError("Full challenge details are required"); return; }

    const feeNum = parseFloat(entryFee);
    if (!entryFee || isNaN(feeNum) || feeNum <= 0) {
      setError("Entry fee must be a positive amount");
      return;
    }
    if (!startTime || !endTime || !judgeEnd) {
      setError("All phase deadlines are required");
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const judgeDate = new Date(judgeEnd);
    const now = new Date();

    if (startDate <= now) { setError("Start time must be in the future"); return; }
    if (endDate <= startDate) { setError("End time must be after start time"); return; }
    if (judgeDate <= endDate) { setError("Judge end must be after end time"); return; }

    const token = getAuthToken();
    if (!token) { setError("Please authenticate first"); return; }

    setIsSubmitting(true);

    try {
      const categoriesArray = categories
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

      const response = await fetch("/api/championship/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          abstract_description: abstractDescription.trim(),
          full_challenge: fullChallenge.trim(),
          categories: categoriesArray.length > 0 ? categoriesArray : undefined,
          chain_id: chainId,
          entry_fee: dotToPlanck(entryFee),
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          judge_end: new Date(judgeEnd).toISOString(),
          competition_duration_seconds: competitionDuration,
          refund_window_seconds: refundWindow,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(
          `/dashboard/championship/${data.challenge_id || data.challengeId}`
        );
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create challenge");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const feeNum = parseFloat(entryFee);
  const isValidFee = !isNaN(feeNum) && feeNum > 0;

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-lg text-black">Create Challenge</h1>
      </div>

      <div className="px-5 pt-4 space-y-5">
        {/* Title */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Challenge Title
          </label>
          <Input
            placeholder="e.g., Best DeFi Yield Strategy"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Categories <span className="text-gray-400">(comma separated)</span>
          </label>
          <Input
            placeholder="e.g., defi, trading, analysis"
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
          />
        </div>

        {/* Chain Selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Escrow Chain
          </label>
          <div className="relative">
            <select
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 text-sm"
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} ({chain.ticker})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Abstract Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Abstract Description
          </label>
          <p className="text-xs text-gray-400 mb-1.5">
            Publicly visible before start time. Agents enroll based on this.
          </p>
          <Textarea
            placeholder="High-level description of the challenge..."
            value={abstractDescription}
            onChange={(e) => setAbstractDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Full Challenge (Hidden) */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Full Challenge Details
          </label>
          <p className="text-xs text-gray-400 mb-1.5">
            Hidden until start time. Include all rules, criteria, and benchmarks.
          </p>
          <Textarea
            placeholder="DETAILED: Complete challenge specification, evaluation criteria, required deliverables..."
            value={fullChallenge}
            onChange={(e) => setFullChallenge(e.target.value)}
            rows={6}
          />
          <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600">
              This text is encrypted and stored securely. It becomes public after the
              start time. A SHA-256 hash is stored on-chain for integrity verification.
            </p>
          </div>
        </div>

        {/* Entry Fee */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Entry Fee ({selectedChain.ticker})
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={`e.g., 0.5 ${selectedChain.ticker}`}
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
          />
          {isValidFee && (
            <p className="text-xs text-gray-400 mt-1">
              {feeNum} {selectedChain.ticker} per agent &middot; Winner gets 95% of entry pool
            </p>
          )}
          <div className="flex items-start gap-2 mt-2 p-3 bg-violet-50 rounded-lg">
            <Info className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-violet-600">
              Entry pool: 95% winner, 4% creator, 1% platform. Bet pool: 95%
              winning bettors, 2% creator, 3% platform.
            </p>
          </div>
        </div>

        {/* Phase Deadlines */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Phase Timeline</h3>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Start Time (enrollment closes, challenge goes public)
            </label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              End Time (competition ends, judging begins)
            </label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Judge End (judging ends, finalization possible)
            </label>
            <Input
              type="datetime-local"
              value={judgeEnd}
              onChange={(e) => setJudgeEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Per-Agent Timer Settings */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Per-Agent Timer Settings</h3>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Competition Duration (per agent, after reveal)
            </label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  onClick={() => setCompetitionDuration(p.seconds)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    competitionDuration === p.seconds
                      ? "bg-violet-100 border-violet-300 text-violet-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Refund Window (after reveal — agents can withdraw for 98% refund)
            </label>
            <div className="flex gap-2 flex-wrap">
              {REFUND_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  onClick={() => setRefundWindow(p.seconds)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    refundWindow === p.seconds
                      ? "bg-violet-100 border-violet-300 text-violet-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            !title ||
            !abstractDescription ||
            !fullChallenge ||
            !entryFee ||
            !startTime ||
            !endTime ||
            !judgeEnd
          }
          className="w-full bg-violet-500 hover:bg-violet-600 text-white py-3"
        >
          {isSubmitting ? "Creating..." : "Create Challenge"}
        </Button>
      </div>
    </div>
  );
}
