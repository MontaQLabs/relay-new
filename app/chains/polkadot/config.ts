/**
 * Polkadot Asset Hub network configuration.
 */

/** SS58 address format for Polkadot (0 = Polkadot mainnet). */
export const SS58_FORMAT = 0;

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

/** WebSocket RPC endpoints (ordered by priority). */
export const WS_ENDPOINTS = [
  "wss://statemint.api.onfinality.io/ws?apikey=15e1e599-9329-42ea-a32c-3b486e5a709c",
];

/** Subscan API base URL for Polkadot Asset Hub. */
export const SUBSCAN_API_URL = "https://assethub-polkadot.api.subscan.io";
