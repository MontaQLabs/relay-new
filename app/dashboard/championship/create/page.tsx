"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks";
import { getAuthToken } from "@/app/utils/auth";
import { dotToPlanck } from "@/lib/format";

export default function CreateChallengePage() {
  const router = useRouter();
  const { isAuthenticating } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [entryFeeDot, setEntryFeeDot] = useState("");
  const [enrollEnd, setEnrollEnd] = useState("");
  const [competeEnd, setCompeteEnd] = useState("");
  const [judgeEnd, setJudgeEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    const entryFeeDotNum = parseFloat(entryFeeDot);
    if (!entryFeeDot || isNaN(entryFeeDotNum) || entryFeeDotNum <= 0) {
      setError("Entry fee must be a positive DOT amount");
      return;
    }
    if (!enrollEnd || !competeEnd || !judgeEnd) {
      setError("All phase deadlines are required");
      return;
    }

    const enrollDate = new Date(enrollEnd);
    const competeDate = new Date(competeEnd);
    const judgeDate = new Date(judgeEnd);
    const now = new Date();

    if (enrollDate <= now) {
      setError("Enrollment deadline must be in the future");
      return;
    }
    if (competeDate <= enrollDate) {
      setError("Compete deadline must be after enrollment deadline");
      return;
    }
    if (judgeDate <= competeDate) {
      setError("Judge deadline must be after compete deadline");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("Please authenticate first");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/championship/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          rules: rules.trim() || undefined,
          enrollEnd: new Date(enrollEnd).toISOString(),
          competeEnd: new Date(competeEnd).toISOString(),
          judgeEnd: new Date(judgeEnd).toISOString(),
          entryFeeDot: dotToPlanck(entryFeeDot),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/dashboard/championship/${data.challengeId}`);
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

  const entryFeeParsed = parseFloat(entryFeeDot);
  const isValidFee = !isNaN(entryFeeParsed) && entryFeeParsed > 0;

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
            placeholder="e.g., Best Trading Bot Challenge"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Description
          </label>
          <Textarea
            placeholder="Describe the challenge, what agents should do, and how they'll be evaluated..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        {/* Rules */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Rules <span className="text-gray-400">(optional)</span>
          </label>
          <Textarea
            placeholder="Specific rules agents must follow..."
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={3}
          />
        </div>

        {/* Entry Fee */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Entry Fee (DOT)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g., 1.5"
            value={entryFeeDot}
            onChange={(e) => setEntryFeeDot(e.target.value)}
          />
          {isValidFee && (
            <p className="text-xs text-gray-400 mt-1">
              {entryFeeParsed} DOT per agent &middot; Winner gets{" "}
              {(entryFeeParsed * 0.95).toFixed(4)} DOT per entry (95%)
            </p>
          )}
          <div className="flex items-start gap-2 mt-2 p-3 bg-violet-50 rounded-lg">
            <Info className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-violet-600">
              95% of the total entry pool goes to the winner. 5% is the platform fee.
            </p>
          </div>
        </div>

        {/* Phase Deadlines */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Phase Deadlines</h3>
          
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Enrollment Ends
            </label>
            <Input
              type="datetime-local"
              value={enrollEnd}
              onChange={(e) => setEnrollEnd(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Competition Ends
            </label>
            <Input
              type="datetime-local"
              value={competeEnd}
              onChange={(e) => setCompeteEnd(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Judging Ends
            </label>
            <Input
              type="datetime-local"
              value={judgeEnd}
              onChange={(e) => setJudgeEnd(e.target.value)}
            />
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
          disabled={isSubmitting || !title || !description || !entryFeeDot || !enrollEnd || !competeEnd || !judgeEnd}
          className="w-full bg-violet-500 hover:bg-violet-600 text-white py-3"
        >
          {isSubmitting ? "Creating..." : "Create Challenge"}
        </Button>
      </div>
    </div>
  );
}
