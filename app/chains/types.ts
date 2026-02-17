/**
 * Multi-chain adapter types for Relay.
 *
 * Every supported blockchain implements the ChainAdapter interface so the rest
 * of the application can interact with any chain through a uniform API.
 */

// ---------------------------------------------------------------------------
// Chain metadata
// ---------------------------------------------------------------------------

/** Broad family a chain belongs to – drives shared logic (e.g. EVM wallets). */
export type ChainType = "substrate" | "evm" | "solana" | "near";

/** Unique, lowercase identifier for a chain. */
export type ChainId = "polkadot" | "base" | "solana" | "monad" | "near";

/** Whether the app is pointed at mainnet or testnet RPCs. */
export type NetworkMode = "mainnet" | "testnet";

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/** A token balance on a specific chain. */
export interface ChainCoin {
  ticker: string;
  name: string;
  amount: number;
  decimals: number;
  symbol: string; // icon URL
  contractAddress?: string; // ERC-20 / SPL mint address (empty for native)
}

/** Fee estimate returned by an adapter. */
export interface ChainFeeEstimate {
  fee: bigint;
  feeFormatted: string;
  feeTicker: string;
}

/** Result of a transfer operation. */
export interface ChainTransferResult {
  success: boolean;
  txHash?: string;
  blockHash?: string;
  error?: string;
}

/** A single transaction record. */
export interface ChainTransaction {
  id: string;
  from: string;
  to: string;
  ticker: string;
  amount: number;
  fee: number;
  timestamp: string;
  status: "completed" | "pending" | "failed";
  type: "sent" | "received";
  blockHash?: string;
}

// ---------------------------------------------------------------------------
// Transfer parameters
// ---------------------------------------------------------------------------

/** Parameters for fee estimation (no private key needed). */
export interface TransferParams {
  senderAddress: string;
  recipientAddress: string;
  ticker: string;
  amount: number;
  /** Optional token contract / asset id for non-native transfers. */
  tokenIdentifier?: string | number;
}

/** Parameters for executing a signed transfer. */
export interface SignedTransferParams extends TransferParams {
  mnemonic: string;
}

// ---------------------------------------------------------------------------
// Chain account (used in the Wallet model)
// ---------------------------------------------------------------------------

export interface ChainAccount {
  chainId: ChainId;
  address: string;
  coins?: ChainCoin[];
}

// ---------------------------------------------------------------------------
// ChainAdapter – the contract every chain module must implement
// ---------------------------------------------------------------------------

export interface ChainAdapter {
  /** Unique chain identifier. */
  readonly chainId: ChainId;
  /** Human-readable chain name. */
  readonly chainName: string;
  /** Chain family. */
  readonly chainType: ChainType;
  /** Ticker of the chain's native gas token. */
  readonly nativeTicker: string;
  /** URL to the chain's logo / icon. */
  readonly iconUrl: string;

  // -- Account derivation ---------------------------------------------------
  /** Derive a chain-specific address from a BIP-39 mnemonic. */
  deriveAddress(mnemonic: string): Promise<string>;
  /** Validate an address string for this chain. */
  isValidAddress(address: string): boolean;

  // -- Balances -------------------------------------------------------------
  /** Fetch native + token balances for an address. */
  fetchBalances(address: string): Promise<ChainCoin[]>;

  // -- Transfers ------------------------------------------------------------
  /** Estimate the fee for a transfer without submitting it. */
  estimateFee(params: TransferParams): Promise<ChainFeeEstimate>;
  /** Sign and submit a transfer. */
  sendTransfer(params: SignedTransferParams): Promise<ChainTransferResult>;

  // -- Transaction history --------------------------------------------------
  /** Fetch recent transactions for an address. */
  fetchTransactions(address: string, page?: number): Promise<ChainTransaction[]>;
}
