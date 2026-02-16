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
 * Chain ID 143 – mainnet values from docs.monad.xyz.
 */
const monadChain = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://monadexplorer.com",
    },
  },
  testnet: false,
});

const MONAD_CONFIG: EVMChainConfig = {
  chainId: "monad",
  chainName: "Monad",
  nativeTicker: "MON",
  nativeDecimals: 18,
  iconUrl: "https://www.monad.xyz/monad-logo.png",
  viemChain: monadChain,
  rpcUrl: "https://rpc.monad.xyz",
};

export function createMonadAdapter(): EVMChainAdapter {
  return new EVMChainAdapter(MONAD_CONFIG);
}
