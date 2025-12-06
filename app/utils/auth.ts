/**
 * Wallet-based Authentication Utilities
 * 
 * This module provides authentication using Polkadot wallet signatures.
 * Users prove ownership of their wallet by signing a message with their private key.
 * 
 * Flow:
 * 1. Request a nonce from the server
 * 2. Sign the nonce message with the wallet
 * 3. Send signature to server for verification
 * 4. Receive JWT token for Supabase authentication
 */

import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto';
import { SS58_FORMAT, WALLET_SEED_KEY, WALLET_KEY } from '../types/constants';
import { Wallet } from '../types/frontend_type';
import { setSupabaseAuth, clearSupabaseAuth, upsertUser } from '../db/supabase';

// ============================================================================
// Types
// ============================================================================

export interface AuthResult {
  success: boolean;
  walletAddress?: string;
  token?: string;
  error?: string;
}

export interface NonceResponse {
  message: string;
  nonce: string;
}

export interface VerifyResponse {
  token: string;
}

// ============================================================================
// Constants
// ============================================================================

const AUTH_TOKEN_KEY = 'relay-auth-token';
const AUTH_WALLET_KEY = 'relay-auth-wallet';

// ============================================================================
// Client-side Authentication Functions
// ============================================================================

/**
 * Sign a message with the user's wallet
 * This proves ownership of the wallet without exposing the private key
 */
export const signMessage = async (
  message: string,
  mnemonic: string
): Promise<{ signature: string; address: string }> => {
  await cryptoWaitReady();

  const keyring = new Keyring({ type: 'sr25519', ss58Format: SS58_FORMAT });
  const pair = keyring.addFromMnemonic(mnemonic);

  // Sign the message
  const signatureU8a = pair.sign(message);
  const signature = Buffer.from(signatureU8a).toString('hex');

  return {
    signature,
    address: pair.address,
  };
};

/**
 * Verify a signature (used server-side, but can be used client-side for testing)
 */
export const verifySignature = async (
  message: string,
  signature: string,
  address: string
): Promise<boolean> => {
  await cryptoWaitReady();

  try {
    const { isValid } = signatureVerify(
      message,
      Buffer.from(signature, 'hex'),
      address
    );
    return isValid;
  } catch {
    return false;
  }
};

/**
 * Get wallet address from mnemonic
 */
export const getWalletAddress = async (mnemonic: string): Promise<string> => {
  await cryptoWaitReady();

  const keyring = new Keyring({ type: 'sr25519', ss58Format: SS58_FORMAT });
  const pair = keyring.addFromMnemonic(mnemonic);

  return pair.address;
};

/**
 * Full authentication flow using wallet signature
 * 
 * @param mnemonic - The wallet's mnemonic phrase (from localStorage)
 * @returns AuthResult with success status and token if successful
 */
export const authenticateWithWallet = async (mnemonic?: string): Promise<AuthResult> => {
  try {
    // Get mnemonic from parameter or localStorage
    const seed = mnemonic || (typeof window !== 'undefined' ? localStorage.getItem(WALLET_SEED_KEY) : null);
    
    if (!seed) {
      return {
        success: false,
        error: 'No wallet seed found. Please import or create a wallet first.',
      };
    }

    // Get wallet address
    const walletAddress = await getWalletAddress(seed);

    // Step 1: Request nonce from server
    const nonceResponse = await fetch('/api/auth/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });

    if (!nonceResponse.ok) {
      const error = await nonceResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to get authentication nonce',
      };
    }

    const { message, nonce } = (await nonceResponse.json()) as NonceResponse;

    // Step 2: Sign the message with wallet
    const { signature } = await signMessage(message, seed);

    // Step 3: Verify signature and get JWT
    const verifyResponse = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature, nonce }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return {
        success: false,
        error: error.error || 'Signature verification failed',
      };
    }

    const { token } = (await verifyResponse.json()) as VerifyResponse;

    // Step 4: Set the token in Supabase client
    await setSupabaseAuth(token);

    // Step 5: Store token for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_WALLET_KEY, walletAddress);
    }

    // Step 6: Ensure user exists in database
    await upsertUser(walletAddress);

    return {
      success: true,
      walletAddress,
      token,
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
};

/**
 * Check if user is currently authenticated
 */
export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;

  // Check if token is expired
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() < exp;
  } catch {
    return false;
  }
};

/**
 * Get the currently authenticated wallet address
 */
export const getAuthenticatedWallet = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_WALLET_KEY);
};

/**
 * Get the current auth token
 */
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Restore authentication session from stored token
 * Call this on app initialization
 */
export const restoreSession = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;

  // Check if token is expired
  if (!isAuthenticated()) {
    // Token expired, try to re-authenticate
    const result = await authenticateWithWallet();
    return result.success;
  }

  // Token is valid, set it in Supabase
  await setSupabaseAuth(token);
  return true;
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  // Clear Supabase session
  await clearSupabaseAuth();

  // Clear stored tokens
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_WALLET_KEY);
  }
};

/**
 * Refresh authentication token
 * Re-authenticates using the stored wallet seed
 */
export const refreshAuth = async (): Promise<AuthResult> => {
  return authenticateWithWallet();
};

// ============================================================================
// Server-side Utilities (for API routes)
// ============================================================================

/**
 * Generate a random nonce for authentication
 */
export const generateNonce = (): string => {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for Node.js environment
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Create the message that will be signed by the user
 */
export const createAuthMessage = (nonce: string, walletAddress: string): string => {
  return `Sign this message to authenticate with Relay.

Nonce: ${nonce}
Wallet: ${walletAddress}
Timestamp: ${new Date().toISOString()}

This signature will not trigger any blockchain transaction or cost any fees.`;
};

/**
 * Validate wallet address format (basic validation)
 */
export const isValidWalletAddress = (address: string): boolean => {
  // Polkadot addresses are typically 47-48 characters
  // and start with 1 (Polkadot) or 5 (generic substrate)
  if (!address || address.length < 45 || address.length > 50) {
    return false;
  }

  // Check for valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
};

// ============================================================================
// Legacy Support (for existing code compatibility)
// ============================================================================

/**
 * @deprecated Use isAuthenticated() instead
 */
export const fakeAuth = (): boolean => {
  return isAuthenticated();
};
