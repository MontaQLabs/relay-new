/**
 * NEAR Protocol network configuration.
 */

/** Unique chain identifier used in the registry. */
export const CHAIN_ID = "near" as const;

/** Human-readable network name. */
export const NETWORK_NAME = "NEAR";

/** Native token ticker. */
export const NATIVE_TICKER = "NEAR";

/** Native token decimals (1 NEAR = 10^24 yoctoNEAR). */
export const NEAR_DECIMALS = 24;

/** Chain icon URL. */
export const ICON_URL =
  "https://assets.coingecko.com/coins/images/10365/small/near.jpg";

/** JSON-RPC endpoint (mainnet). */
export const RPC_URL = "https://rpc.mainnet.near.org";

/** NearBlocks API base URL for transaction history. */
export const NEARBLOCKS_API_URL = "https://api.nearblocks.io/v1";
