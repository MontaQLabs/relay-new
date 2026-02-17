/**
 * Transaction Signing Service
 *
 * Bridges the backend with escrow adapters. Given a mnemonic and chain ID,
 * derives the appropriate keypair and signs transactions.
 *
 * This is a server-side service — mnemonics are only handled in memory
 * and never stored beyond the request lifecycle.
 */

import type { ChainId } from "../chains/types";
import type { ChainKeypair } from "./escrow/types";

// ---------------------------------------------------------------------------
// Keypair derivation per chain
// ---------------------------------------------------------------------------

/**
 * Derive a Solana keypair from a BIP-39 mnemonic.
 * Uses the same derivation path as the SolanaChainAdapter.
 */
export async function deriveSolanaKeypair(
  mnemonic: string
): Promise<ChainKeypair> {
  // Dynamic import to avoid bundling in client code
  const { Keypair } = await import("@solana/web3.js");
  const { mnemonicToSeedSync } = await import("bip39");
  const { derivePath } = await import("ed25519-hd-key");

  const seed = mnemonicToSeedSync(mnemonic);
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString("hex")).key;
  return Keypair.fromSeed(derivedSeed);
}

/**
 * Derive an EVM keypair (private key) from a BIP-39 mnemonic.
 * Works for Base, Polkadot Asset Hub (EVM), and Monad.
 */
export async function deriveEVMPrivateKey(
  mnemonic: string
): Promise<ChainKeypair> {
  const { HDKey } = await import("@scure/bip32");
  const { mnemonicToSeedSync } = await import("bip39");

  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const childKey = hdKey.derive("m/44'/60'/0'/0/0");
  return childKey.privateKey;
}

/**
 * Derive a Polkadot keypair from a BIP-39 mnemonic.
 */
export async function derivePolkadotKeypair(
  mnemonic: string
): Promise<ChainKeypair> {
  const { Keyring } = await import("@polkadot/keyring");
  const { cryptoWaitReady } = await import("@polkadot/util-crypto");

  await cryptoWaitReady();
  const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
  return keyring.addFromMnemonic(mnemonic);
}

// ---------------------------------------------------------------------------
// Chain-agnostic keypair derivation
// ---------------------------------------------------------------------------

/**
 * Derive the appropriate keypair for a given chain from a mnemonic.
 */
export async function deriveKeypair(
  mnemonic: string,
  chainId: ChainId
): Promise<ChainKeypair> {
  switch (chainId) {
    case "solana":
      return deriveSolanaKeypair(mnemonic);
    case "base":
    case "monad":
      return deriveEVMPrivateKey(mnemonic);
    case "polkadot":
      return derivePolkadotKeypair(mnemonic);
    case "near":
      // NEAR uses ed25519 — derivation TBD when NEAR escrow is implemented
      return deriveSolanaKeypair(mnemonic); // placeholder
    default:
      throw new Error(`Unsupported chain for keypair derivation: ${chainId}`);
  }
}

// ---------------------------------------------------------------------------
// Transaction helper
// ---------------------------------------------------------------------------

/**
 * Sign and submit an escrow transaction.
 *
 * This is the main entry point used by API routes that need to execute
 * on-chain escrow operations (enroll, bet, withdraw, etc.).
 *
 * @param chainId - Which chain to transact on
 * @param mnemonic - BIP-39 mnemonic of the signer
 * @param operation - Async function that takes a keypair and escrow adapter
 */
export async function signAndSubmit(
  chainId: ChainId,
  mnemonic: string,
  operation: (keypair: ChainKeypair, adapter: import("./escrow/types").IEscrowAdapter) => Promise<import("./escrow/types").TxResult>
): Promise<import("./escrow/types").TxResult> {
  const { getEscrowAdapter } = await import("./escrow/registry");

  const keypair = await deriveKeypair(mnemonic, chainId);
  const adapter = getEscrowAdapter(chainId);

  return operation(keypair, adapter);
}
