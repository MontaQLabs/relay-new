/**
 * Poker Arena Contract — Paseo Asset Hub
 *
 * Contract: 0xc0e447413d0cade5bb4dc865fc4bea706757f20b
 * Network:  Paseo Asset Hub (testnet) → production: Polkadot Asset Hub
 *
 * This file is the single source of truth for the contract address, ABI,
 * and the viem public client used to read from it. Write operations (joinTable,
 * placeBet, createTable, claimChips, claimPrize, claimBetWinnings, refund)
 * are signed in the browser via the user's existing relay wallet mnemonic.
 */

import { createPublicClient, http, defineChain, type Abi } from "viem";

// ---------------------------------------------------------------------------
// Paseo Asset Hub chain definition
// ---------------------------------------------------------------------------

export const paseoAssetHub = defineChain({
  id: 420420421,
  name: "Paseo Asset Hub",
  nativeCurrency: { name: "PAS", symbol: "PAS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://asset-hub-paseo-rpc.dwellir.com"] },
  },
  blockExplorers: {
    default: {
      name: "Paseo Subscan",
      url: "https://assethub-paseo.subscan.io",
    },
  },
  testnet: true,
});

// ---------------------------------------------------------------------------
// Contract address
// ---------------------------------------------------------------------------

export const POKER_ARENA_ADDRESS = "0xc0e447413d0cade5bb4dc865fc4bea706757f20b" as const;

// ---------------------------------------------------------------------------
// ABI (mirrors PokerArena.sol — only what the frontend needs)
// ---------------------------------------------------------------------------

export const POKER_ARENA_ABI = [
  // ---- Write ---------------------------------------------------------------
  {
    name: "createTable",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "buyIn", type: "uint256" },
      { name: "maxAgents", type: "uint8" },
      { name: "sessionLength", type: "uint32" },
      { name: "betDeadline", type: "uint64" },
    ],
    outputs: [{ name: "tableId", type: "uint32" }],
  },
  {
    name: "joinTable",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [{ name: "seat", type: "uint8" }],
  },
  {
    name: "placeBet",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tableId", type: "uint32" },
      { name: "agentSeat", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "claimChips",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [],
  },
  {
    name: "claimPrize",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [],
  },
  {
    name: "claimBetWinnings",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [],
  },
  {
    name: "refund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [],
  },
  // ---- Read ----------------------------------------------------------------
  {
    name: "getTableInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "prizePool", type: "uint256" },
      { name: "buyIn", type: "uint256" },
      { name: "maxAgents", type: "uint8" },
      { name: "agentCount", type: "uint8" },
      { name: "sessionLength", type: "uint32" },
      { name: "currentHand", type: "uint32" },
      { name: "betDeadline", type: "uint64" },
      { name: "state", type: "uint8" },
    ],
  },
  {
    name: "getAgentInfo",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tableId", type: "uint32" },
      { name: "seat", type: "uint8" },
    ],
    outputs: [
      { name: "agent", type: "address" },
      { name: "chips", type: "uint256" },
      { name: "folded", type: "bool" },
      { name: "kicked", type: "bool" },
      { name: "missedTurns", type: "uint8" },
    ],
  },
  {
    name: "getBetInfo",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tableId", type: "uint32" },
      { name: "bettor", type: "address" },
    ],
    outputs: [
      { name: "agentSeat", type: "uint8" },
      { name: "amount", type: "uint256" },
      { name: "claimed", type: "bool" },
    ],
  },
  {
    name: "getAgentBetTotal",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tableId", type: "uint32" },
      { name: "seat", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTotalBetPool",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getCurrentPot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tableId", type: "uint32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ---- Events --------------------------------------------------------------
  {
    name: "TableCreated",
    type: "event",
    inputs: [{ name: "tableId", type: "uint32", indexed: true }],
  },
  {
    name: "AgentJoined",
    type: "event",
    inputs: [
      { name: "tableId", type: "uint32", indexed: true },
      { name: "seat", type: "uint8", indexed: false },
    ],
  },
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      { name: "tableId", type: "uint32", indexed: true },
      { name: "agentSeat", type: "uint8", indexed: false },
    ],
  },
  {
    name: "HandResolved",
    type: "event",
    inputs: [
      { name: "tableId", type: "uint32", indexed: true },
      { name: "handNumber", type: "uint32", indexed: false },
      { name: "winningSeat", type: "uint8", indexed: false },
    ],
  },
  {
    name: "SessionEnded",
    type: "event",
    inputs: [{ name: "tableId", type: "uint32", indexed: true }],
  },
  {
    name: "AgentKicked",
    type: "event",
    inputs: [
      { name: "tableId", type: "uint32", indexed: true },
      { name: "seat", type: "uint8", indexed: false },
      { name: "agent", type: "address", indexed: false },
    ],
  },
] as const satisfies Abi;

// ---------------------------------------------------------------------------
// Public client (read-only, no wallet needed)
// ---------------------------------------------------------------------------

export const pokerArenaClient = createPublicClient({
  chain: paseoAssetHub,
  transport: http(),
});

// ---------------------------------------------------------------------------
// Table state enum
// ---------------------------------------------------------------------------

export const TABLE_STATE = {
  OPEN: 0,
  PLAYING: 1,
  ENDED: 2,
  CANCELLED: 3,
} as const;

export type TableState = (typeof TABLE_STATE)[keyof typeof TABLE_STATE];

export const TABLE_STATE_LABEL: Record<TableState, string> = {
  0: "Open",
  1: "Playing",
  2: "Ended",
  3: "Cancelled",
};
