/**
 * Unit tests for app/utils/auth.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TEST_WALLET_ADDRESS,
  TEST_WALLET_ADDRESS_2,
  TEST_MNEMONIC,
  validTestJwt,
  expiredTestJwt,
} from '../../setup/fixtures';

// Mock the Polkadot dependencies before importing
vi.mock('@polkadot/keyring', () => ({
  Keyring: vi.fn().mockImplementation(() => ({
    addFromMnemonic: vi.fn(() => ({
      address: TEST_WALLET_ADDRESS,
      publicKey: new Uint8Array(32).fill(1),
      sign: vi.fn(() => new Uint8Array(64).fill(2)),
    })),
  })),
}));

vi.mock('@polkadot/util-crypto', () => ({
  cryptoWaitReady: vi.fn().mockResolvedValue(true),
  signatureVerify: vi.fn((message: string, signature: Buffer, address: string) => ({
    isValid: address === TEST_WALLET_ADDRESS || address === TEST_WALLET_ADDRESS_2,
  })),
}));

vi.mock('@/app/db/supabase', () => ({
  setSupabaseAuth: vi.fn(),
  clearSupabaseAuth: vi.fn(),
  upsertUser: vi.fn().mockResolvedValue(true),
}));

// Now import the module under test
import {
  generateNonce,
  createAuthMessage,
  isValidWalletAddress,
  signMessage,
  verifySignature,
  getWalletAddress,
  isAuthenticated,
  getAuthenticatedWallet,
  getAuthToken,
  signOut,
} from '@/app/utils/auth';

import { clearSupabaseAuth } from '@/app/db/supabase';

describe('Auth Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('generateNonce', () => {
    it('should generate a 64-character hex string', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique nonces on each call', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should only contain valid hex characters', () => {
      const nonce = generateNonce();
      expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
    });
  });

  describe('createAuthMessage', () => {
    it('should include the nonce in the message', () => {
      const nonce = 'test_nonce_123';
      const message = createAuthMessage(nonce, TEST_WALLET_ADDRESS);
      expect(message).toContain(nonce);
    });

    it('should include the wallet address in the message', () => {
      const nonce = 'test_nonce_123';
      const message = createAuthMessage(nonce, TEST_WALLET_ADDRESS);
      expect(message).toContain(TEST_WALLET_ADDRESS);
    });

    it('should include a timestamp in the message', () => {
      const nonce = 'test_nonce_123';
      const message = createAuthMessage(nonce, TEST_WALLET_ADDRESS);
      expect(message).toContain('Timestamp:');
    });

    it('should include the security disclaimer', () => {
      const nonce = 'test_nonce_123';
      const message = createAuthMessage(nonce, TEST_WALLET_ADDRESS);
      expect(message).toContain('This signature will not trigger any blockchain transaction');
    });

    it('should include Sign this message header', () => {
      const nonce = 'test_nonce_123';
      const message = createAuthMessage(nonce, TEST_WALLET_ADDRESS);
      expect(message).toContain('Sign this message to authenticate with Relay');
    });
  });

  describe('isValidWalletAddress', () => {
    it('should return true for valid Polkadot addresses', () => {
      expect(isValidWalletAddress(TEST_WALLET_ADDRESS)).toBe(true);
    });

    it('should return true for another valid address format', () => {
      expect(isValidWalletAddress(TEST_WALLET_ADDRESS_2)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidWalletAddress('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isValidWalletAddress(null as unknown as string)).toBe(false);
      expect(isValidWalletAddress(undefined as unknown as string)).toBe(false);
    });

    it('should return false for too short addresses', () => {
      expect(isValidWalletAddress('1234567890')).toBe(false);
    });

    it('should return false for too long addresses', () => {
      const longAddress = 'a'.repeat(60);
      expect(isValidWalletAddress(longAddress)).toBe(false);
    });

    it('should return false for addresses with invalid characters', () => {
      expect(isValidWalletAddress('0OILX' + 'a'.repeat(43))).toBe(false); // 0, O, I, L are not in base58
    });
  });

  describe('signMessage', () => {
    it('should return signature and address', async () => {
      const result = await signMessage('test message', TEST_MNEMONIC);
      
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('address');
      expect(result.address).toBe(TEST_WALLET_ADDRESS);
    });

    it('should return hex-encoded signature', async () => {
      const result = await signMessage('test message', TEST_MNEMONIC);
      
      expect(result.signature).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('verifySignature', () => {
    it('should return true for valid signature and address', async () => {
      const signature = '0102030405';
      const isValid = await verifySignature('test message', signature, TEST_WALLET_ADDRESS);
      
      expect(isValid).toBe(true);
    });

    it('should return true for valid second address', async () => {
      const signature = '0102030405';
      const isValid = await verifySignature('test message', signature, TEST_WALLET_ADDRESS_2);
      
      expect(isValid).toBe(true);
    });

    it('should return false for invalid address', async () => {
      const signature = '0102030405';
      const isValid = await verifySignature('test message', signature, 'invalid_address');
      
      expect(isValid).toBe(false);
    });
  });

  describe('getWalletAddress', () => {
    it('should return wallet address from mnemonic', async () => {
      const address = await getWalletAddress(TEST_MNEMONIC);
      expect(address).toBe(TEST_WALLET_ADDRESS);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token in localStorage', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('should return true when valid token exists', () => {
      localStorage.setItem('relay-auth-token', validTestJwt);
      expect(isAuthenticated()).toBe(true);
    });

    it('should return false when token is expired', () => {
      localStorage.setItem('relay-auth-token', expiredTestJwt);
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false for malformed token', () => {
      localStorage.setItem('relay-auth-token', 'not-a-valid-jwt');
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false for token with invalid base64', () => {
      localStorage.setItem('relay-auth-token', 'header.!!!invalid!!!.signature');
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('getAuthenticatedWallet', () => {
    it('should return null when no wallet stored', () => {
      expect(getAuthenticatedWallet()).toBeNull();
    });

    it('should return wallet address when stored', () => {
      localStorage.setItem('relay-auth-wallet', TEST_WALLET_ADDRESS);
      expect(getAuthenticatedWallet()).toBe(TEST_WALLET_ADDRESS);
    });
  });

  describe('getAuthToken', () => {
    it('should return null when no token stored', () => {
      expect(getAuthToken()).toBeNull();
    });

    it('should return token when stored', () => {
      localStorage.setItem('relay-auth-token', validTestJwt);
      expect(getAuthToken()).toBe(validTestJwt);
    });
  });

  describe('signOut', () => {
    it('should clear auth tokens from localStorage', async () => {
      localStorage.setItem('relay-auth-token', validTestJwt);
      localStorage.setItem('relay-auth-wallet', TEST_WALLET_ADDRESS);

      await signOut();

      expect(localStorage.getItem('relay-auth-token')).toBeNull();
      expect(localStorage.getItem('relay-auth-wallet')).toBeNull();
    });

    it('should call clearSupabaseAuth', async () => {
      await signOut();
      expect(clearSupabaseAuth).toHaveBeenCalled();
    });
  });
});

