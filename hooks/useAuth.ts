"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authenticateWithWallet, isAuthenticated, getAuthToken } from "@/app/utils/auth";
import { getWalletAddress } from "@/app/utils/wallet";

interface UseAuthOptions {
  redirectOnFail?: string | null;
  requireAuth?: boolean;
}

interface UseAuthReturn {
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  walletAddress: string | null;
  authToken: string | null;
  refreshAuth: () => Promise<void>;
}

/**
 * Hook for handling authentication state
 * Manages wallet-based authentication and provides auth status
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const { redirectOnFail = null, requireAuth = false } = options;
  const router = useRouter();

  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Check if already authenticated
      if (isAuthenticated()) {
        setWalletAddress(getWalletAddress());
        setAuthToken(getAuthToken());
        setIsAuthenticating(false);
        return;
      }

      // Authenticate the user using their wallet
      const result = await authenticateWithWallet();

      if (!result.success) {
        console.log("Authentication note:", result.error);
        setAuthError(result.error || null);

        if (requireAuth && redirectOnFail) {
          router.push(redirectOnFail);
        }
      } else {
        setWalletAddress(getWalletAddress());
        setAuthToken(getAuthToken());
      }
    } catch (error) {
      console.error("Authentication error:", error);
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      setAuthError(errorMessage);

      if (requireAuth && redirectOnFail) {
        router.push(redirectOnFail);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [router, redirectOnFail, requireAuth]);

  // Authenticate on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  return {
    isAuthenticating,
    isAuthenticated: isAuthenticated(),
    authError,
    walletAddress,
    authToken,
    refreshAuth,
  };
}
