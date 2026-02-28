"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Copy, Check, ExternalLink, Shield, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks";
import { useMyAgents, useRegisterAgent, useClaimAgent } from "@/hooks/useAgents";

type ViewMode = "list" | "register" | "claim" | "created";

interface CreatedAgentInfo {
  agentId: string;
  walletAddress: string;
  apiKey: string;
  claimToken: string;
  mnemonic: string;
}

export default function MyAgentsPage() {
  const router = useRouter();
  const { isAuthenticating, walletAddress } = useAuth();
  const { agents, isLoading, refetch } = useMyAgents(walletAddress);
  const { registerAgent, isRegistering } = useRegisterAgent();
  const { claimAgent, isClaiming } = useClaimAgent();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<CreatedAgentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Register form state
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");

  // Claim form state
  const [claimToken, setClaimToken] = useState("");

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRegister = async () => {
    setError(null);
    if (!agentName.trim()) {
      setError("Agent name is required");
      return;
    }

    const result = await registerAgent({
      agentName: agentName.trim(),
      description: description.trim() || undefined,
      repoUrl: repoUrl.trim() || undefined,
      endpointUrl: endpointUrl.trim() || undefined,
    });

    if (result.success) {
      setCreatedAgent({
        agentId: result.agentId!,
        walletAddress: result.walletAddress!,
        apiKey: result.apiKey!,
        claimToken: result.claimToken!,
        mnemonic: result.mnemonic!,
      });
      setViewMode("created");
      refetch();
    } else {
      setError(result.error || "Registration failed");
    }
  };

  const handleClaim = async () => {
    setError(null);
    if (!claimToken.trim()) {
      setError("Claim token is required");
      return;
    }

    const result = await claimAgent(claimToken.trim());
    if (result.success) {
      setClaimToken("");
      setViewMode("list");
      refetch();
    } else {
      setError(result.error || "Claim failed");
    }
  };

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Created agent success view
  if (viewMode === "created" && createdAgent) {
    return (
      <div className="flex flex-col gap-6 p-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Agent Created Successfully</h2>
            <p className="text-sm text-muted-foreground">
              Save these credentials — they are shown only once
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium">
            Store these securely! The mnemonic and API key cannot be recovered.
          </p>
        </div>

        {[
          { label: "Mnemonic", value: createdAgent.mnemonic, field: "mnemonic" },
          { label: "API Key", value: createdAgent.apiKey, field: "apiKey" },
          { label: "Claim Token", value: createdAgent.claimToken, field: "claimToken" },
          { label: "Wallet Address", value: createdAgent.walletAddress, field: "wallet" },
        ].map(({ label, value, field }) => (
          <div key={field} className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <button
                onClick={() => copyToClipboard(value, field)}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
              >
                {copiedField === field ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copiedField === field ? "Copied!" : "Copy"}
              </button>
            </div>
            <code className="text-xs break-all text-gray-800 font-mono">{value}</code>
          </div>
        ))}

        <button
          onClick={() => {
            setViewMode("list");
            setCreatedAgent(null);
            setAgentName("");
            setDescription("");
            setRepoUrl("");
            setEndpointUrl("");
          }}
          className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors"
        >
          Done — Back to Agents
        </button>
      </div>
    );
  }

  // Register form view
  if (viewMode === "register") {
    return (
      <div className="flex flex-col gap-5 p-5 animate-fade-in">
        <button
          onClick={() => setViewMode("list")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h2 className="text-lg font-bold">Register New Agent</h2>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Agent Name *</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="AlphaTrader"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Repository URL (optional)
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Endpoint URL (optional)
            </label>
            <input
              type="url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://agent.example.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
            />
          </div>
        </div>

        <button
          onClick={handleRegister}
          disabled={isRegistering || !agentName.trim()}
          className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRegistering ? "Creating Agent..." : "Register Agent"}
        </button>
      </div>
    );
  }

  // Claim form view
  if (viewMode === "claim") {
    return (
      <div className="flex flex-col gap-5 p-5 animate-fade-in">
        <button
          onClick={() => setViewMode("list")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h2 className="text-lg font-bold">Claim an Agent</h2>
        <p className="text-sm text-muted-foreground">
          Enter the claim token provided when the agent was registered.
        </p>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Claim Token</label>
          <input
            type="text"
            value={claimToken}
            onChange={(e) => setClaimToken(e.target.value)}
            placeholder="rly_ct_..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 font-mono text-sm"
          />
        </div>

        <button
          onClick={handleClaim}
          disabled={isClaiming || !claimToken.trim()}
          className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClaiming ? "Claiming..." : "Claim Agent"}
        </button>
      </div>
    );
  }

  // Agent list view (default)
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/championship")}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">My Agents</h1>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 flex flex-col gap-3">
        <button
          onClick={() => setViewMode("register")}
          className="flex items-center gap-4 w-full text-left group"
        >
          <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
            <Plus className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-black">Register Agent</span>
            <span className="text-sm text-muted-foreground">
              Create a new AI agent with its own wallet
            </span>
          </div>
        </button>

        <button
          onClick={() => setViewMode("claim")}
          className="flex items-center gap-4 w-full text-left group"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-black">Claim Agent</span>
            <span className="text-sm text-muted-foreground">
              Link an existing agent using a claim token
            </span>
          </div>
        </button>
      </div>

      {/* Agent List */}
      <div className="px-5 pb-5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No agents yet. Register or claim one to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="border border-gray-100 rounded-xl p-4 hover:border-violet-200 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{agent.agentName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {agent.walletAddress.substring(0, 12)}...
                        {agent.walletAddress.substring(agent.walletAddress.length - 6)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      agent.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {agent.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {agent.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{agent.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  {agent.repoUrl && (
                    <a
                      href={agent.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
                    >
                      <ExternalLink className="w-3 h-3" /> Repo
                    </a>
                  )}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex gap-1">
                      {agent.capabilities.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
