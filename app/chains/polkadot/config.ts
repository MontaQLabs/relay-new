/**
 * Polkadot Asset Hub network configuration.
 */

import type { NetworkMode } from "../types";

/** Human-readable network name. */
export const NETWORK_NAME = "Polkadot Asset Hub";

/** Unique chain identifier used in the registry. */
export const CHAIN_ID = "polkadot" as const;

/** Native token ticker. */
export const NATIVE_TICKER = "DOT";

/** Native token decimals. */
export const DOT_DECIMALS = 10;

/** Chain icon URL. */
export const ICON_URL =
  "https://assets.coingecko.com/coins/images/12171/small/polkadot.png";

interface PolkadotNetworkConfig {
  ss58Format: number;
  wsEndpoints: string[];
  subscanApiUrl: string;
}

const CONFIGS: Record<NetworkMode, PolkadotNetworkConfig> = {
  mainnet: {
    ss58Format: 0,
    wsEndpoints: [
      "wss://statemint.api.onfinality.io/ws?apikey=15e1e599-9329-42ea-a32c-3b486e5a709c",
    ],
    subscanApiUrl: "https://assethub-polkadot.api.subscan.io",
  },
  testnet: {
    ss58Format: 42,
    wsEndpoints: [
      "wss://westend-asset-hub-rpc.polkadot.io",
    ],
    subscanApiUrl: "https://assethub-westend.api.subscan.io",
  },
};

export function getConfig(mode: NetworkMode): PolkadotNetworkConfig {
  return CONFIGS[mode];
}

/** @deprecated Use getConfig(mode).ss58Format instead. */
export const SS58_FORMAT = CONFIGS.mainnet.ss58Format;

/** @deprecated Use getConfig(mode).wsEndpoints instead. */
export const WS_ENDPOINTS = CONFIGS.mainnet.wsEndpoints;

/** @deprecated Use getConfig(mode).subscanApiUrl instead. */
export const SUBSCAN_API_URL = CONFIGS.mainnet.subscanApiUrl;
