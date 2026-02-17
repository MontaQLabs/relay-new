/**
 * ChainRegistry – singleton that manages all registered ChainAdapter instances.
 *
 * Usage:
 *   const registry = getChainRegistry();
 *   const adapter  = registry.get("base");
 *   const accounts = await registry.deriveAllAddresses(mnemonic);
 */

import type { ChainAdapter, ChainAccount, ChainId, NetworkMode } from "./types";
import { NETWORK_MODE_KEY } from "../types/constants";

class ChainRegistry {
  private adapters = new Map<ChainId, ChainAdapter>();

  /** Register a chain adapter. Overwrites any existing adapter for the same chainId. */
  register(adapter: ChainAdapter): void {
    this.adapters.set(adapter.chainId, adapter);
  }

  /** Get an adapter by chain id. Throws if not registered. */
  get(chainId: ChainId): ChainAdapter {
    const adapter = this.adapters.get(chainId);
    if (!adapter) {
      throw new Error(`No adapter registered for chain "${chainId}"`);
    }
    return adapter;
  }

  /** Get an adapter by chain id, or undefined if not registered. */
  find(chainId: ChainId): ChainAdapter | undefined {
    return this.adapters.get(chainId);
  }

  /** Return all registered adapters. */
  getAll(): ChainAdapter[] {
    return Array.from(this.adapters.values());
  }

  /** Return all registered chain ids. */
  getChainIds(): ChainId[] {
    return Array.from(this.adapters.keys());
  }

  /** Clear all registered adapters so the registry can be re-initialised. */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Derive an address on every registered chain from a single BIP-39 mnemonic.
   * Returns an array of ChainAccount objects.
   */
  async deriveAllAddresses(mnemonic: string): Promise<ChainAccount[]> {
    const results = await Promise.all(
      this.getAll().map(async (adapter) => {
        const address = await adapter.deriveAddress(mnemonic);
        return {
          chainId: adapter.chainId,
          address,
        } satisfies ChainAccount;
      })
    );
    return results;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: ChainRegistry | null = null;
let currentMode: NetworkMode | null = null;

/**
 * Get (or create) the global ChainRegistry singleton.
 * Adapters are registered lazily on first access.
 */
export function getChainRegistry(): ChainRegistry {
  if (!instance) {
    instance = new ChainRegistry();
  }
  return instance;
}

/**
 * Read the current network mode from localStorage (falls back to "mainnet").
 */
export function getStoredNetworkMode(): NetworkMode {
  if (typeof window === "undefined") return "mainnet";
  const stored = localStorage.getItem(NETWORK_MODE_KEY);
  return stored === "testnet" ? "testnet" : "mainnet";
}

/**
 * Reset the registry so the next initChainRegistry() call re-creates
 * adapters with the (potentially changed) network mode.
 */
export function resetRegistry(): void {
  if (instance) {
    instance.clear();
  }
  currentMode = null;
}

/**
 * Initialise the registry with all built-in adapters for the given network mode.
 * Call once at app startup (e.g. in a top-level layout or provider).
 * If mode is omitted, it reads from localStorage.
 */
export async function initChainRegistry(
  mode?: NetworkMode
): Promise<ChainRegistry> {
  const resolvedMode = mode ?? getStoredNetworkMode();
  const registry = getChainRegistry();

  // Only register once per mode
  if (registry.getAll().length > 0 && currentMode === resolvedMode) {
    return registry;
  }

  // Mode changed or first init – clear and re-register
  registry.clear();
  currentMode = resolvedMode;

  // Dynamic imports keep each chain's deps out of bundles that don't use them
  const [
    { PolkadotChainAdapter },
    { createBaseAdapter, createMonadAdapter },
    { SolanaChainAdapter },
    { NearChainAdapter },
  ] = await Promise.all([
    import("./polkadot/adapter"),
    import("./evm/chains"),
    import("./solana/adapter"),
    import("./near/adapter"),
  ]);

  registry.register(new PolkadotChainAdapter(resolvedMode));
  registry.register(createBaseAdapter(resolvedMode));
  registry.register(createMonadAdapter(resolvedMode));
  registry.register(new SolanaChainAdapter(resolvedMode));
  registry.register(new NearChainAdapter(resolvedMode));

  return registry;
}
