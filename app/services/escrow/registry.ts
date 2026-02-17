/**
 * EscrowRegistry — maps chain IDs to IEscrowAdapter implementations.
 *
 * Usage:
 *   const adapter = getEscrowAdapter("solana");
 *   await adapter.enroll(params, keypair);
 */

import type { ChainId } from "../../chains/types";
import type { IEscrowAdapter } from "./types";

class EscrowRegistry {
  private adapters = new Map<ChainId, IEscrowAdapter>();

  register(adapter: IEscrowAdapter): void {
    this.adapters.set(adapter.chainId, adapter);
  }

  get(chainId: ChainId): IEscrowAdapter {
    const adapter = this.adapters.get(chainId);
    if (!adapter) {
      throw new Error(
        `No escrow adapter registered for chain "${chainId}". ` +
          `Available: [${Array.from(this.adapters.keys()).join(", ")}]`
      );
    }
    return adapter;
  }

  find(chainId: ChainId): IEscrowAdapter | undefined {
    return this.adapters.get(chainId);
  }

  getAll(): IEscrowAdapter[] {
    return Array.from(this.adapters.values());
  }

  getSupportedChains(): ChainId[] {
    return Array.from(this.adapters.keys());
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: EscrowRegistry | null = null;

export function getEscrowRegistry(): EscrowRegistry {
  if (!instance) {
    instance = new EscrowRegistry();
  }
  return instance;
}

/**
 * Convenience: get the escrow adapter for a given chain.
 * Throws if no adapter is registered for the chain.
 */
export function getEscrowAdapter(chainId: ChainId): IEscrowAdapter {
  return getEscrowRegistry().get(chainId);
}

/**
 * Initialise all escrow adapters.
 * Call once at server startup.
 */
export async function initEscrowRegistry(): Promise<EscrowRegistry> {
  const registry = getEscrowRegistry();
  if (registry.getAll().length > 0) return registry;

  // Solana adapter (first chain — others added as they're implemented)
  const { SolanaEscrowAdapter } = await import("./solana");
  registry.register(new SolanaEscrowAdapter());

  return registry;
}
