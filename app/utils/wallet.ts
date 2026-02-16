import { Wallet } from "../types/frontend_type";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate, mnemonicValidate, cryptoWaitReady, decodeAddress, encodeAddress } from "@polkadot/util-crypto";
import { POLKADOT_NETWORK_NAME, SS58_FORMAT, WALLET_KEY, WALLET_SEED_KEY, ENCRYPTED_WALLET_KEY, IS_ENCRYPTED_KEY, USER_KEY } from "../types/constants";
import { initChainRegistry } from "../chains/registry";
import type { ChainAccount } from "../chains/types";

// Check if user already has "relay-wallet" in their browser's local storage
export const exists = (): boolean => {
  if (typeof window === "undefined") return false;
  const isEncrypted = localStorage.getItem(IS_ENCRYPTED_KEY);
  if (!isEncrypted) return false;

  return true;
};

/**
 * Derive chain accounts from a mnemonic using all registered chain adapters.
 * Falls back to Polkadot-only if the registry fails to initialise.
 */
async function deriveChainAccounts(mnemonic: string): Promise<ChainAccount[]> {
  try {
    const registry = await initChainRegistry();
    return await registry.deriveAllAddresses(mnemonic);
  } catch (err) {
    console.warn("Chain registry init failed, falling back to Polkadot only:", err);
    const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
    const pair = keyring.addFromMnemonic(mnemonic);
    return [{ chainId: "polkadot", address: pair.address }];
  }
}

/**
 * Creates a new multi-chain relay wallet.
 * Generates a BIP39 mnemonic and derives addresses for every registered chain.
 * The Polkadot address is used as the primary identity for auth.
 * 
 * @returns Promise<Wallet> - The newly created wallet object
 */
export const createWallet = async (): Promise<Wallet> => {
  await cryptoWaitReady();

  const mnemonic = mnemonicGenerate(12);

  // Derive addresses on all supported chains
  const chainAccounts = await deriveChainAccounts(mnemonic);
  const polkadotAccount = chainAccounts.find(a => a.chainId === "polkadot");

  const wallet: Wallet = {
    address: polkadotAccount?.address ?? "",
    network: POLKADOT_NETWORK_NAME,
    chainAccounts,
    coins: [],
    status: "inactive",
    isBackedUp: false,
  };

  if (typeof window !== "undefined") {
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(WALLET_SEED_KEY);
    localStorage.removeItem(ENCRYPTED_WALLET_KEY);
    localStorage.removeItem(IS_ENCRYPTED_KEY);
    localStorage.removeItem(USER_KEY);

    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    localStorage.setItem(WALLET_SEED_KEY, mnemonic);
  }

  return wallet;
};

/**
 * Imports an existing wallet using a space-separated seed phrase.
 * Validates the mnemonic, then derives addresses for every registered chain.
 * 
 * @param seedPhrase - Space-separated 12-word mnemonic seed phrase
 * @returns Promise<Wallet> - The imported wallet object
 * @throws Error if the mnemonic is invalid
 */
export const importWallet = async (seedPhrase: string): Promise<Wallet> => {
  await cryptoWaitReady();

  const normalizedMnemonic = seedPhrase.trim().toLowerCase().replace(/\s+/g, ' ');

  const isValid = mnemonicValidate(normalizedMnemonic);
  if (!isValid) {
    throw new Error("Invalid seed phrase. Please check your words and try again.");
  }

  // Derive addresses on all supported chains
  const chainAccounts = await deriveChainAccounts(normalizedMnemonic);
  const polkadotAccount = chainAccounts.find(a => a.chainId === "polkadot");

  const wallet: Wallet = {
    address: polkadotAccount?.address ?? "",
    network: POLKADOT_NETWORK_NAME,
    chainAccounts,
    coins: [],
    status: "inactive",
    isBackedUp: true,
  };

  if (typeof window !== "undefined") {
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(WALLET_SEED_KEY);
    localStorage.removeItem(ENCRYPTED_WALLET_KEY);
    localStorage.removeItem(IS_ENCRYPTED_KEY);
    localStorage.removeItem(USER_KEY);

    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    localStorage.setItem(WALLET_SEED_KEY, normalizedMnemonic);
  }

  return wallet;
};

// Check if a wallet has been created in the right format
export const isCreated = (): boolean => {
  if (typeof window === "undefined") return false;
  const walletData = localStorage.getItem(WALLET_KEY);
  if (!walletData) return false;
  
  try {
    const wallet = JSON.parse(walletData) as Wallet;
    // Validate the wallet has required fields
    // TODO: Should change to more sophisticated validation later
    return Boolean(wallet.address && wallet.network && wallet.status);
  } catch {
    return false;
  }
}

// Check if Web Crypto API is available (requires HTTPS or localhost)
const isSecureContext = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.isSecureContext && typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
};

// Encrypt the wallet data using the user specified password and store it in localStorage
export const encryptWallet = async (wallet: Wallet, password: string): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  
  if (!isSecureContext()) {
    console.error("Web Crypto API not available. Ensure the app is served over HTTPS.");
    throw new Error("Encryption requires a secure connection (HTTPS)");
  }

  try {
    // Get the mnemonic seed as well
    const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
    
    // Create data object to encrypt (wallet + mnemonic)
    const dataToEncrypt = JSON.stringify({
      wallet,
      mnemonic,
    });

    // Generate a random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive encryption key from password using PBKDF2
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // Encrypt the data using AES-GCM
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encoder.encode(dataToEncrypt)
    );

    // Combine salt + iv + encrypted data and convert to base64 for storage
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

    const encryptedBase64 = btoa(String.fromCharCode(...combined));

    // Store encrypted data in localStorage
    localStorage.setItem(ENCRYPTED_WALLET_KEY, encryptedBase64);

    // Delete the unencrypted wallet and seed from localStorage
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(WALLET_SEED_KEY);

    // Set encryption flag
    localStorage.setItem(IS_ENCRYPTED_KEY, "true");

    return true;
  } catch (error) {
    console.error("Failed to encrypt wallet:", error);
    return false;
  }
}

// Decrypt the encrypted wallet stored in localStorage using the user specified password
export const decryptWallet = async (password: string): Promise<Wallet | null> => {
  if (typeof window === "undefined") return null;
  
  if (!isSecureContext()) {
    console.error("Web Crypto API not available. Ensure the app is served over HTTPS.");
    throw new Error("Decryption requires a secure connection (HTTPS)");
  }

  try {
    // Get the encrypted data from localStorage
    const encryptedBase64 = localStorage.getItem(ENCRYPTED_WALLET_KEY);
    if (!encryptedBase64) return null;

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

    // Extract salt (16 bytes), IV (12 bytes), and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);

    // Derive decryption key from password using PBKDF2 (same parameters as encryption)
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decrypt the data using AES-GCM
    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encryptedData
    );

    // Decode and parse the decrypted data
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedData);
    const { wallet, mnemonic } = JSON.parse(decryptedString) as {
      wallet: Wallet;
      mnemonic: string;
    };

    // Restore wallet and mnemonic to localStorage
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    if (mnemonic) {
      localStorage.setItem(WALLET_SEED_KEY, mnemonic);
    }

    // Update encryption flag (keep encrypted wallet in localStorage)
    localStorage.setItem(IS_ENCRYPTED_KEY, "false");
    localStorage.setItem(ENCRYPTED_WALLET_KEY, encryptedBase64);

    return wallet;
  } catch (error) {
    console.error("Failed to decrypt wallet:", error);
    return null;
  }
}

/**
 * Check if an address is valid on *any* supported chain.
 * For backward-compatibility the function accepts a bare address string.
 * To validate for a specific chain, pass the optional chainId.
 */
export const isAddrValid = (addr: string, chainId?: string): boolean => {
  if (!addr || addr.trim() === "") return false;

  // If a specific chain is requested, delegate to its adapter
  if (chainId) {
    try {
      // Lazy import to avoid circular deps at module level
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getChainRegistry } = require("../chains/registry");
      const adapter = getChainRegistry().find(chainId);
      if (adapter) return adapter.isValidAddress(addr);
    } catch { /* registry not initialised – fall through */ }
  }

  // Default: check Polkadot (original behaviour)
  try {
    const decoded = decodeAddress(addr);
    encodeAddress(decoded);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the wallet address from localStorage
 * @returns The wallet address or null if not found
 */
export const getWalletAddress = (): string | null => {
  if (typeof window === "undefined") return null;
  
  try {
    const walletData = localStorage.getItem(WALLET_KEY);
    if (!walletData) return null;
    
    const wallet = JSON.parse(walletData) as Wallet;
    return wallet.address || null;
  } catch {
    return null;
  }
}