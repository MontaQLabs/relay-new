/**
 * Solana network configuration.
 */

/** Unique chain identifier used in the registry. */
export const CHAIN_ID = "solana" as const;

/** Human-readable network name. */
export const NETWORK_NAME = "Solana";

/** Native token ticker. */
export const NATIVE_TICKER = "SOL";

/** Native token decimals (1 SOL = 10^9 lamports). */
export const SOL_DECIMALS = 9;

/** Chain icon URL. */
export const ICON_URL =
  "https://assets.coingecko.com/coins/images/4128/small/solana.png";

/** JSON-RPC endpoint (mainnet-beta). Public, CORS-friendly endpoint. */
export const RPC_URL = "https://solana-rpc.publicnode.com";

/** BIP-44 derivation path for Solana. */
export const DERIVATION_PATH = "m/44'/501'/0'/0'";
