/**
 * Unit tests for app/utils/wallet.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TEST_WALLET_ADDRESS,
  TEST_WALLET_ADDRESS_2,
  TEST_MNEMONIC,
  testWallet,
} from "../../setup/fixtures";

// Mock the Polkadot dependencies
vi.mock("@polkadot/keyring", () => ({
  Keyring: vi.fn().mockImplementation(() => ({
    addFromMnemonic: vi.fn(() => ({
      address: TEST_WALLET_ADDRESS,
      publicKey: new Uint8Array(32).fill(1),
      sign: vi.fn(() => new Uint8Array(64).fill(2)),
    })),
  })),
}));

vi.mock("@polkadot/util-crypto", () => ({
  cryptoWaitReady: vi.fn().mockResolvedValue(true),
  mnemonicGenerate: vi.fn(() => TEST_MNEMONIC),
  mnemonicValidate: vi.fn((mnemonic: string) => {
    const words = mnemonic.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
  }),
  decodeAddress: vi.fn((address: string) => {
    if (address === "invalid_address") {
      throw new Error("Invalid address");
    }
    return new Uint8Array(32).fill(0);
  }),
  encodeAddress: vi.fn(() => TEST_WALLET_ADDRESS),
}));

vi.mock("@/app/chains/registry", () => ({
  initChainRegistry: vi.fn().mockRejectedValue(new Error("mock")),
}));

// Import after mocking
import {
  exists,
  createWallet,
  importWallet,
  isCreated,
  isAddrValid,
  getWalletAddress,
} from "@/app/utils/wallet";

import {
  WALLET_KEY,
  WALLET_SEED_KEY,
  IS_ENCRYPTED_KEY,
  ENCRYPTED_WALLET_KEY,
  USER_KEY,
} from "@/app/types/constants";

describe("Wallet Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("exists", () => {
    it("should return false when no encryption flag exists", () => {
      expect(exists()).toBe(false);
    });

    it("should return true when encryption flag exists", () => {
      localStorage.setItem(IS_ENCRYPTED_KEY, "true");
      expect(exists()).toBe(true);
    });

    it("should return true when encryption flag is false but exists", () => {
      localStorage.setItem(IS_ENCRYPTED_KEY, "false");
      expect(exists()).toBe(true);
    });
  });

  describe("createWallet", () => {
    it("should create a wallet with correct network", async () => {
      const wallet = await createWallet();
      expect(wallet.network).toBe("Polkadot Asset Hub");
    });

    it("should create a wallet with an address", async () => {
      const wallet = await createWallet();
      expect(wallet.address).toBe(TEST_WALLET_ADDRESS);
    });

    it("should set isBackedUp to false for new wallets", async () => {
      const wallet = await createWallet();
      expect(wallet.isBackedUp).toBe(false);
    });

    it("should set status to inactive for new wallets", async () => {
      const wallet = await createWallet();
      expect(wallet.status).toBe("inactive");
    });

    it("should store wallet in localStorage", async () => {
      await createWallet();
      const storedWallet = localStorage.getItem(WALLET_KEY);
      expect(storedWallet).not.toBeNull();
      expect(JSON.parse(storedWallet!)).toHaveProperty("address");
    });

    it("should store mnemonic in localStorage separately", async () => {
      await createWallet();
      const storedMnemonic = localStorage.getItem(WALLET_SEED_KEY);
      expect(storedMnemonic).toBe(TEST_MNEMONIC);
    });

    it("should clear previous wallet data before creating new wallet", async () => {
      localStorage.setItem(WALLET_KEY, "old_wallet");
      localStorage.setItem(WALLET_SEED_KEY, "old_seed");
      localStorage.setItem(ENCRYPTED_WALLET_KEY, "old_encrypted");
      localStorage.setItem(IS_ENCRYPTED_KEY, "true");
      localStorage.setItem(USER_KEY, "old_user");

      await createWallet();

      // The old data should be replaced, not still there as 'old_*'
      expect(localStorage.getItem(WALLET_KEY)).not.toBe("old_wallet");
      expect(localStorage.getItem(WALLET_SEED_KEY)).toBe(TEST_MNEMONIC);
    });

    it("should initialize coins as empty array", async () => {
      const wallet = await createWallet();
      expect(wallet.coins).toEqual([]);
    });
  });

  describe("importWallet", () => {
    it("should import wallet with valid mnemonic", async () => {
      const wallet = await importWallet(TEST_MNEMONIC);
      expect(wallet.address).toBe(TEST_WALLET_ADDRESS);
    });

    it("should set isBackedUp to true for imported wallets", async () => {
      const wallet = await importWallet(TEST_MNEMONIC);
      expect(wallet.isBackedUp).toBe(true);
    });

    it("should normalize mnemonic (trim and single spaces)", async () => {
      const messyMnemonic = `  ${TEST_MNEMONIC.replace(/ /g, "   ")}  `;
      const wallet = await importWallet(messyMnemonic);
      expect(wallet.address).toBe(TEST_WALLET_ADDRESS);
    });

    it("should throw error for invalid mnemonic", async () => {
      await expect(importWallet("invalid mnemonic phrase")).rejects.toThrow("Invalid seed phrase");
    });

    it("should throw error for mnemonic with wrong word count", async () => {
      await expect(importWallet("one two three")).rejects.toThrow("Invalid seed phrase");
    });

    it("should store wallet in localStorage", async () => {
      await importWallet(TEST_MNEMONIC);
      const storedWallet = localStorage.getItem(WALLET_KEY);
      expect(storedWallet).not.toBeNull();
    });

    it("should store normalized mnemonic in localStorage", async () => {
      await importWallet(TEST_MNEMONIC);
      const storedMnemonic = localStorage.getItem(WALLET_SEED_KEY);
      expect(storedMnemonic).toBe(TEST_MNEMONIC.toLowerCase());
    });

    it("should clear previous wallet data", async () => {
      localStorage.setItem(IS_ENCRYPTED_KEY, "true");
      await importWallet(TEST_MNEMONIC);
      expect(localStorage.getItem(IS_ENCRYPTED_KEY)).toBeNull();
    });
  });

  describe("isCreated", () => {
    it("should return false when no wallet in localStorage", () => {
      expect(isCreated()).toBe(false);
    });

    it("should return true for valid wallet data", () => {
      localStorage.setItem(WALLET_KEY, JSON.stringify(testWallet));
      expect(isCreated()).toBe(true);
    });

    it("should return false for invalid JSON", () => {
      localStorage.setItem(WALLET_KEY, "invalid json");
      expect(isCreated()).toBe(false);
    });

    it("should return false for wallet missing address", () => {
      localStorage.setItem(WALLET_KEY, JSON.stringify({ network: "test", status: "active" }));
      expect(isCreated()).toBe(false);
    });

    it("should return false for wallet missing network", () => {
      localStorage.setItem(WALLET_KEY, JSON.stringify({ address: "test", status: "active" }));
      expect(isCreated()).toBe(false);
    });

    it("should return false for wallet missing status", () => {
      localStorage.setItem(WALLET_KEY, JSON.stringify({ address: "test", network: "test" }));
      expect(isCreated()).toBe(false);
    });
  });

  describe("isAddrValid", () => {
    it("should return true for valid addresses", () => {
      expect(isAddrValid(TEST_WALLET_ADDRESS)).toBe(true);
    });

    it("should return true for second valid address", () => {
      expect(isAddrValid(TEST_WALLET_ADDRESS_2)).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isAddrValid("")).toBe(false);
    });

    it("should return false for whitespace only", () => {
      expect(isAddrValid("   ")).toBe(false);
    });

    it("should return false for invalid address", () => {
      expect(isAddrValid("invalid_address")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isAddrValid(null as unknown as string)).toBe(false);
      expect(isAddrValid(undefined as unknown as string)).toBe(false);
    });
  });

  describe("getWalletAddress", () => {
    it("should return null when no wallet in localStorage", () => {
      expect(getWalletAddress()).toBeNull();
    });

    it("should return wallet address when stored", () => {
      localStorage.setItem(WALLET_KEY, JSON.stringify(testWallet));
      expect(getWalletAddress()).toBe(TEST_WALLET_ADDRESS);
    });

    it("should return null for invalid JSON", () => {
      localStorage.setItem(WALLET_KEY, "invalid json");
      expect(getWalletAddress()).toBeNull();
    });

    it("should return null if address is empty", () => {
      localStorage.setItem(WALLET_KEY, JSON.stringify({ ...testWallet, address: "" }));
      expect(getWalletAddress()).toBeNull();
    });
  });
});
