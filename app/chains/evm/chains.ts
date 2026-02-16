/**
 * Pre-configured EVM chain adapters for Base and Monad.
 *
 * Both share the same EVMChainAdapter class – only the config differs.
 * Add new EVM chains by creating another factory function here.
 */

import { base } from "viem/chains";
import { defineChain } from "viem";
import { EVMChainAdapter, type EVMChainConfig } from "./adapter";

// ---------------------------------------------------------------------------
// Base (Coinbase L2)
// ---------------------------------------------------------------------------

const BASE_CONFIG: EVMChainConfig = {
  chainId: "base",
  chainName: "Base",
  nativeTicker: "ETH",
  nativeDecimals: 18,
  iconUrl:
    "https://assets.coingecko.com/coins/images/1/small/bitcoin.png?1547033579", // placeholder – swap for Base logo
  viemChain: base,
  rpcUrl: "https://mainnet.base.org",
  blockExplorerApiUrl: "https://api.basescan.org/api",
};

export function createBaseAdapter(): EVMChainAdapter {
  return new EVMChainAdapter(BASE_CONFIG);
}

// ---------------------------------------------------------------------------
// Monad
// ---------------------------------------------------------------------------

/**
 * Monad is EVM-compatible at the bytecode level.
 * Chain ID and RPC are from the Monad documentation / testnet.
 * Update these once Monad mainnet launches with final values.
 */
const monadChain = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.monad.xyz/v1"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

const MONAD_CONFIG: EVMChainConfig = {
  chainId: "monad",
  chainName: "Monad",
  nativeTicker: "MON",
  nativeDecimals: 18,
  iconUrl: "https://www.monad.xyz/monad-logo.png",
  viemChain: monadChain,
  rpcUrl: "https://testnet.monad.xyz/v1",
  // Explorer API not yet available; transactions will return empty for now
};

export function createMonadAdapter(): EVMChainAdapter {
  return new EVMChainAdapter(MONAD_CONFIG);
}
