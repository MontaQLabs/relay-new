/**
 * Multi-chain module barrel export.
 *
 * Usage:
 *   import { getChainRegistry, initChainRegistry } from "@/app/chains";
 *   import type { ChainAdapter, ChainId } from "@/app/chains";
 */

export { getChainRegistry, initChainRegistry } from "./registry";
export type {
  ChainAdapter,
  ChainId,
  ChainType,
  ChainAccount,
  ChainCoin,
  ChainFeeEstimate,
  ChainTransferResult,
  ChainTransaction,
  TransferParams,
  SignedTransferParams,
} from "./types";
