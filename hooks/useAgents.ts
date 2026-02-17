"use client";

import { useState, useEffect, useCallback } from "react";
import type { Agent } from "@/app/types/frontend_type";
import { getAuthToken } from "@/app/utils/auth";

// ============================================================================
// My Agents Hook — fetches agents owned by the current user
// ============================================================================

interface UseMyAgentsReturn {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMyAgents(walletAddress: string | null): UseMyAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!walletAddress) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await fetch(
        `/api/agents?owner=${encodeURIComponent(walletAddress)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }

      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, isLoading, error, refetch: fetchAgents };
}

// ============================================================================
// Register Agent Hook
// ============================================================================

interface RegisterAgentParams {
  agentName: string;
  description?: string;
  repoUrl?: string;
  endpointUrl?: string;
  capabilities?: string[];
}

interface RegisterAgentResult {
  success: boolean;
  agentId?: string;
  walletAddress?: string;
  apiKey?: string;
  claimToken?: string;
  mnemonic?: string;
  error?: string;
}

export function useRegisterAgent() {
  const [isRegistering, setIsRegistering] = useState(false);

  const registerAgent = useCallback(
    async (params: RegisterAgentParams): Promise<RegisterAgentResult> => {
      setIsRegistering(true);
      try {
        const response = await fetch("/api/agents/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_name: params.agentName,
            description: params.description,
            repo_url: params.repoUrl,
            endpoint_url: params.endpointUrl,
            capabilities: params.capabilities,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error || "Registration failed" };
        }

        return {
          success: true,
          agentId: data.agent_id,
          walletAddress: data.wallet_address,
          apiKey: data.api_key,
          claimToken: data.claim_token,
          mnemonic: data.mnemonic,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Registration failed",
        };
      } finally {
        setIsRegistering(false);
      }
    },
    []
  );

  return { registerAgent, isRegistering };
}

// ============================================================================
// Claim Agent Hook
// ============================================================================

export function useClaimAgent() {
  const [isClaiming, setIsClaiming] = useState(false);

  const claimAgent = useCallback(
    async (claimToken: string): Promise<{ success: boolean; agentName?: string; error?: string }> => {
      setIsClaiming(true);
      try {
        const token = getAuthToken();
        const response = await fetch("/api/agents/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ claim_token: claimToken }),
        });

        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.error || "Claim failed" };
        }

        return { success: true, agentName: data.agent_name };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Claim failed",
        };
      } finally {
        setIsClaiming(false);
      }
    },
    []
  );

  return { claimAgent, isClaiming };
}
