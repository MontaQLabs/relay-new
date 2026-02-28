/**
 * NEAR Protocol network configuration.
 */

import type { NetworkMode } from "../types";

/** Unique chain identifier used in the registry. */
export const CHAIN_ID = "near" as const;

/** Human-readable network name. */
export const NETWORK_NAME = "NEAR";

/** Native token ticker. */
export const NATIVE_TICKER = "NEAR";

/** Native token decimals (1 NEAR = 10^24 yoctoNEAR). */
export const NEAR_DECIMALS = 24;

/** Chain icon URL. */
export const ICON_URL = "https://assets.coingecko.com/coins/images/10365/small/near.jpg";

interface NearNetworkConfig {
  rpcUrl: string;
  nearblocksApiUrl: string;
}

const CONFIGS: Record<NetworkMode, NearNetworkConfig> = {
  mainnet: {
    rpcUrl: "https://rpc.mainnet.near.org",
    nearblocksApiUrl: "https://api.nearblocks.io/v1",
  },
  testnet: {
    rpcUrl: "https://rpc.testnet.near.org",
    nearblocksApiUrl: "https://api-testnet.nearblocks.io/v1",
  },
};

export function getConfig(mode: NetworkMode): NearNetworkConfig {
  return CONFIGS[mode];
}

/** @deprecated Use getConfig(mode).rpcUrl instead. */
export const RPC_URL = CONFIGS.mainnet.rpcUrl;

/** @deprecated Use getConfig(mode).nearblocksApiUrl instead. */
export const NEARBLOCKS_API_URL = CONFIGS.mainnet.nearblocksApiUrl;
