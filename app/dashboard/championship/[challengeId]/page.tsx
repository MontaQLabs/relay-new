"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks";
import { useChallengeDetail, useChallengeResults, useBetStats } from "@/hooks/useChampionship";
import {
  PhaseTimeline,
  AgentCard,
  BetPanel,
  VotePanel,
  ResultsPanel,
} from "@/components/championship";
import { getAuthToken } from "@/app/utils/auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPlanckAsDot } from "@/lib/format";
import type { ChallengeAgent } from "@/app/types/frontend_type";

export default function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = use(params);
  const router = useRouter();
  const { walletAddress } = useAuth();
  const { challenge, agents, isLoading, error, refetch } = useChallengeDetail(challengeId);
  const results = useChallengeResults(challengeId);
  const betStats = useBetStats(challengeId, walletAddress);

  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-5">
        <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-500">{error || "Challenge not found"}</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const userHasEnrolled = agents.some((a) => a.owner === walletAddress);
  const isCreator = challenge.creator === walletAddress;

  return (
    <div className="flex flex-col animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg text-black truncate">{challenge.title}</h1>
          <p className="text-xs text-gray-400">
            by {challenge.creator.slice(0, 6)}...{challenge.creator.slice(-4)}
          </p>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-5">
        {/* Phase Timeline */}
        <PhaseTimeline
          status={challenge.status}
          startTime={challenge.startTime}
          endTime={challenge.endTime}
          judgeEnd={challenge.judgeEnd}
        />

        {/* Challenge Info */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{challenge.description}</p>
          {challenge.rules && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-1">Rules</p>
              <p className="text-sm text-gray-700">{challenge.rules}</p>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Entry: {formatPlanckAsDot(challenge.entryFeeDot)}</span>
            <span>Agents: {agents.length}</span>
            <span>
              Pool:{" "}
              {formatPlanckAsDot(
                (
                  BigInt(challenge.totalEntryPoolDot || "0") +
                  BigInt(challenge.totalBetPoolDot || "0")
                ).toString()
              )}
            </span>
          </div>
        </div>

        {/* Phase-Specific Content */}
        {challenge.status === "enrolling" && (
          <EnrollSection
            challengeId={challengeId}
            agents={agents}
            userHasEnrolled={userHasEnrolled}
            entryFee={challenge.entryFeeDot}
            showEnrollForm={showEnrollForm}
            setShowEnrollForm={setShowEnrollForm}
            onEnrollSuccess={refetch}
          />
        )}

        {challenge.status === "competing" && (
          <CompeteSection
            challengeId={challengeId}
            agents={agents}
            totalBetPool={challenge.totalBetPoolDot}
            onBetPlaced={() => {
              refetch();
              betStats.refetch();
            }}
          />
        )}

        {challenge.status === "judging" && (
          <JudgeSection
            challengeId={challengeId}
            agents={agents}
            hasVoted={hasVoted}
            isCreator={isCreator}
            judgeEnd={challenge.judgeEnd}
            onVoteCast={() => {
              setHasVoted(true);
              refetch();
            }}
            onFinalize={refetch}
          />
        )}

        {challenge.status === "completed" && (
          <ResultsPanel
            agents={results.agents.length > 0 ? results.agents : agents}
            winnerAgentId={challenge.winnerAgentId}
            payouts={results.payouts}
            totalEntryPool={challenge.totalEntryPoolDot}
            totalBetPool={challenge.totalBetPoolDot}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Enroll Section
// ============================================================================

function EnrollSection({
  challengeId,
  agents,
  userHasEnrolled,
  entryFee,
  showEnrollForm,
  setShowEnrollForm,
  onEnrollSuccess,
}: {
  challengeId: string;
  agents: ChallengeAgent[];
  userHasEnrolled: boolean;
  entryFee: string;
  showEnrollForm: boolean;
  setShowEnrollForm: (v: boolean) => void;
  onEnrollSuccess: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Enroll CTA */}
      {!userHasEnrolled && !showEnrollForm && (
        <Button
          onClick={() => setShowEnrollForm(true)}
          className="w-full bg-violet-500 hover:bg-violet-600 text-white"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Enroll Your Agent ({formatPlanckAsDot(entryFee)})
        </Button>
      )}

      {userHasEnrolled && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-center">
          <p className="text-sm font-medium text-green-700">
            You have enrolled an agent in this challenge
          </p>
        </div>
      )}

      {/* Enroll Form */}
      {showEnrollForm && (
        <EnrollForm
          challengeId={challengeId}
          entryFee={entryFee}
          onCancel={() => setShowEnrollForm(false)}
          onSuccess={() => {
            setShowEnrollForm(false);
            onEnrollSuccess();
          }}
        />
      )}

      {/* Enrolled Agents */}
      {agents.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Enrolled Agents ({agents.length})</h3>
          <div className="space-y-2">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Enroll Form
// ============================================================================

function EnrollForm({
  challengeId,
  entryFee,
  onCancel,
  onSuccess,
}: {
  challengeId: string;
  entryFee: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [agentName, setAgentName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [description, setDescription] = useState("");
  const [entryTxHash, setEntryTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!agentName.trim()) {
      setError("Agent name is required");
      return;
    }
    if (!repoUrl.includes("github.com")) {
      setError("A valid GitHub URL is required");
      return;
    }
    if (!commitHash.trim()) {
      setError("Commit hash is required");
      return;
    }
    if (!endpointUrl.trim()) {
      setError("Endpoint URL is required");
      return;
    }
    if (!entryTxHash.trim()) {
      setError("Entry fee transaction hash is required");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("Please authenticate first");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/championship/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challengeId,
          agentName: agentName.trim(),
          repoUrl: repoUrl.trim(),
          commitHash: commitHash.trim(),
          endpointUrl: endpointUrl.trim(),
          description: description.trim() || undefined,
          entryTxHash: entryTxHash.trim(),
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to enroll agent");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 border border-violet-200 rounded-xl bg-violet-50/30 space-y-3">
      <h3 className="font-semibold text-gray-900">Enroll Your Agent</h3>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Agent Name</label>
        <Input
          placeholder="My Awesome Agent"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">GitHub Repo URL</label>
        <Input
          placeholder="https://github.com/user/agent-repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Commit Hash</label>
        <Input
          placeholder="abc1234..."
          value={commitHash}
          onChange={(e) => setCommitHash(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Deployed Endpoint URL</label>
        <Input
          placeholder="https://my-agent.example.com/api"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
        <Textarea
          placeholder="Describe what your agent does..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          Entry Fee Tx Hash ({formatPlanckAsDot(entryFee)})
        </label>
        <Input
          placeholder="0x... (tx hash after sending entry fee to escrow)"
          value={entryTxHash}
          onChange={(e) => setEntryTxHash(e.target.value)}
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Send {formatPlanckAsDot(entryFee)} to the challenge escrow address, then paste the
          transaction hash.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-violet-500 hover:bg-violet-600 text-white"
        >
          {isSubmitting ? "Enrolling..." : "Enroll & Pay"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Compete Section
// ============================================================================

function CompeteSection({
  challengeId,
  agents,
  totalBetPool,
  onBetPlaced,
}: {
  challengeId: string;
  agents: ChallengeAgent[];
  totalBetPool: string;
  onBetPlaced: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Agents */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Competing Agents ({agents.length})</h3>
        <p className="text-xs text-gray-500 mb-3">
          Inspect the source code of each agent to make your prediction.
        </p>
        <div className="space-y-2">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Bet Panel */}
      <BetPanel
        challengeId={challengeId}
        agents={agents}
        totalBetPool={totalBetPool}
        onBetPlaced={onBetPlaced}
      />
    </div>
  );
}

// ============================================================================
// Judge Section
// ============================================================================

function JudgeSection({
  challengeId,
  agents,
  hasVoted,
  isCreator,
  judgeEnd,
  onVoteCast,
  onFinalize,
}: {
  challengeId: string;
  agents: ChallengeAgent[];
  hasVoted: boolean;
  isCreator: boolean;
  judgeEnd: string;
  onVoteCast: () => void;
  onFinalize: () => void;
}) {
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const judgeEnded = new Date(judgeEnd) < new Date();

  const handleFinalize = async () => {
    const token = getAuthToken();
    if (!token) return;

    setIsFinalizing(true);
    setFinalizeError(null);

    try {
      const response = await fetch(`/api/championship/${challengeId}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        onFinalize();
      } else {
        const data = await response.json();
        setFinalizeError(data.error || "Failed to finalize");
      }
    } catch {
      setFinalizeError("Network error");
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="space-y-4">
      <VotePanel
        challengeId={challengeId}
        agents={agents}
        hasVoted={hasVoted}
        onVoteCast={onVoteCast}
      />

      {/* Finalize button for creator after judge phase ends */}
      {isCreator && judgeEnded && (
        <div className="p-4 border border-amber-200 rounded-xl bg-amber-50">
          <p className="text-sm text-amber-700 mb-3">
            The judge phase has ended. Finalize the challenge to determine the winner and distribute
            payouts.
          </p>
          {finalizeError && <p className="text-xs text-red-500 mb-2">{finalizeError}</p>}
          <Button
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          >
            {isFinalizing ? "Finalizing..." : "Finalize & Distribute Payouts"}
          </Button>
        </div>
      )}
    </div>
  );
}
