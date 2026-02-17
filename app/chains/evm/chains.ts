/**
 * Pre-configured EVM chain adapters for Base and Monad.
 *
 * Both share the same EVMChainAdapter class – only the config differs.
 * Add new EVM chains by creating another factory function here.
 */

import { base, baseSepolia } from "viem/chains";
import { defineChain } from "viem";
import { EVMChainAdapter, type EVMChainConfig } from "./adapter";
import type { NetworkMode } from "../types";

// ---------------------------------------------------------------------------
// Base (Coinbase L2)
// ---------------------------------------------------------------------------

const BASE_CONFIGS: Record<NetworkMode, EVMChainConfig> = {
  mainnet: {
    chainId: "base",
    chainName: "Base",
    nativeTicker: "ETH",
    nativeDecimals: 18,
    iconUrl:
      "https://assets.coingecko.com/coins/images/1/small/bitcoin.png?1547033579",
    viemChain: base,
    rpcUrl: "https://mainnet.base.org",
    blockExplorerApiUrl: "https://api.basescan.org/api",
  },
  testnet: {
    chainId: "base",
    chainName: "Base Sepolia",
    nativeTicker: "ETH",
    nativeDecimals: 18,
    iconUrl:
      "https://assets.coingecko.com/coins/images/1/small/bitcoin.png?1547033579",
    viemChain: baseSepolia,
    rpcUrl: "https://sepolia.base.org",
    blockExplorerApiUrl: "https://api-sepolia.basescan.org/api",
  },
};

export function createBaseAdapter(mode: NetworkMode = "mainnet"): EVMChainAdapter {
  return new EVMChainAdapter(BASE_CONFIGS[mode]);
}

// ---------------------------------------------------------------------------
// Monad
// ---------------------------------------------------------------------------

/**
 * Monad is EVM-compatible at the bytecode level.
 * Chain ID 143 – mainnet values from docs.monad.xyz.
 */
const monadMainnet = defineChain({
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

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Testnet Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

const MONAD_CONFIGS: Record<NetworkMode, EVMChainConfig> = {
  mainnet: {
    chainId: "monad",
    chainName: "Monad",
    nativeTicker: "MON",
    nativeDecimals: 18,
    iconUrl: "https://www.monad.xyz/monad-logo.png",
    viemChain: monadMainnet,
    rpcUrl: "https://rpc.monad.xyz",
  },
  testnet: {
    chainId: "monad",
    chainName: "Monad Testnet",
    nativeTicker: "MON",
    nativeDecimals: 18,
    iconUrl: "https://www.monad.xyz/monad-logo.png",
    viemChain: monadTestnet,
    rpcUrl: "https://testnet-rpc.monad.xyz",
  },
};

export function createMonadAdapter(mode: NetworkMode = "mainnet"): EVMChainAdapter {
  return new EVMChainAdapter(MONAD_CONFIGS[mode]);
}
