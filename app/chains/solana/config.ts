/**
 * Solana network configuration.
 */

import type { NetworkMode } from "../types";

/** Unique chain identifier used in the registry. */
export const CHAIN_ID = "solana" as const;

/** Human-readable network name. */
export const NETWORK_NAME = "Solana";

/** Native token ticker. */
export const NATIVE_TICKER = "SOL";

/** Native token decimals (1 SOL = 10^9 lamports). */
export const SOL_DECIMALS = 9;

/** Chain icon URL. */
export const ICON_URL = "https://assets.coingecko.com/coins/images/4128/small/solana.png";

/** BIP-44 derivation path for Solana. */
export const DERIVATION_PATH = "m/44'/501'/0'/0'";

interface SolanaNetworkConfig {
  rpcUrl: string;
}

const CONFIGS: Record<NetworkMode, SolanaNetworkConfig> = {
  mainnet: {
    rpcUrl: "https://solana-rpc.publicnode.com",
  },
  testnet: {
    rpcUrl: "https://api.testnet.solana.com",
  },
};

export function getConfig(mode: NetworkMode): SolanaNetworkConfig {
  return CONFIGS[mode];
}

/** @deprecated Use getConfig(mode).rpcUrl instead. Kept for backward compat. */
export const RPC_URL = CONFIGS.mainnet.rpcUrl;
