/**
 * NEAR Protocol chain adapter.
 *
 * Uses near-api-js v7 for RPC interactions and its built-in seed-phrase module
 * for BIP-44 key derivation from the shared mnemonic.
 */

import {
  Account,
  keyToImplicitAddress,
  formatNearAmount,
  parseNearAmount,
} from "near-api-js";
import { parseSeedPhrase } from "near-api-js/seed-phrase";

import type {
  ChainAdapter,
  ChainCoin,
  ChainFeeEstimate,
  ChainTransferResult,
  ChainTransaction,
  SignedTransferParams,
  NetworkMode,
} from "../types";

import {
  CHAIN_ID,
  NETWORK_NAME,
  NATIVE_TICKER,
  NEAR_DECIMALS,
  ICON_URL,
  getConfig,
} from "./config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a NEAR KeyPair and implicit account ID from a BIP-39 mnemonic. */
function deriveNearAccount(mnemonic: string) {
  const keyPair = parseSeedPhrase(mnemonic);
  const accountId = keyToImplicitAddress(keyPair.getPublicKey());
  return { keyPair, accountId };
}

// ---------------------------------------------------------------------------
// NearChainAdapter
// ---------------------------------------------------------------------------

export class NearChainAdapter implements ChainAdapter {
  readonly chainId = CHAIN_ID;
  readonly chainName = NETWORK_NAME;
  readonly chainType = "near" as const;
  readonly nativeTicker = NATIVE_TICKER;
  readonly iconUrl = ICON_URL;

  private rpcUrl: string;
  private nearblocksApiUrl: string;

  constructor(mode: NetworkMode = "mainnet") {
    const cfg = getConfig(mode);
    this.rpcUrl = cfg.rpcUrl;
    this.nearblocksApiUrl = cfg.nearblocksApiUrl;
  }

  // -- Account derivation ---------------------------------------------------

  async deriveAddress(mnemonic: string): Promise<string> {
    const { accountId } = deriveNearAccount(mnemonic);
    return accountId;
  }

  isValidAddress(address: string): boolean {
    if (!address) return false;
    // Implicit account: exactly 64 hex characters
    if (/^[0-9a-f]{64}$/.test(address)) return true;
    // Named account: 2-64 chars, lowercase alphanumeric + _ - .
    if (
      address.length >= 2 &&
      address.length <= 64 &&
      /^[a-z\d][a-z\d._-]*[a-z\d]$/.test(address)
    ) {
      return true;
    }
    return false;
  }

  // -- Balances -------------------------------------------------------------

  async fetchBalances(address: string): Promise<ChainCoin[]> {
    try {
      const account = new Account(address, this.rpcUrl);
      const balance = await account.getBalance();

      if (balance <= BigInt(0)) return [];

      const formatted = formatNearAmount(balance);
      const amount = parseFloat(formatted);

      if (amount <= 0) return [];

      return [
        {
          ticker: NATIVE_TICKER,
          name: "NEAR",
          amount,
          decimals: NEAR_DECIMALS,
          symbol: ICON_URL,
        },
      ];
    } catch {
      // Account doesn't exist yet or RPC error
      return [];
    }
  }

  // -- Transfers ------------------------------------------------------------

  async estimateFee(): Promise<ChainFeeEstimate> {
    const fee = BigInt("450000000000000000000");
    return {
      fee,
      feeFormatted: "0.00045",
      feeTicker: NATIVE_TICKER,
    };
  }

  async sendTransfer(
    params: SignedTransferParams
  ): Promise<ChainTransferResult> {
    try {
      const { keyPair, accountId } = deriveNearAccount(params.mnemonic);

      const account = new Account(accountId, this.rpcUrl, keyPair.toString());

      const yocto = parseNearAmount(params.amount);
      if (!yocto) throw new Error("Invalid amount");

      const result = await account.transfer({
        receiverId: params.recipientAddress,
        amount: BigInt(yocto),
      });

      const txHash = result.transaction_outcome?.id ?? "";

      return { success: true, txHash };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      };
    }
  }

  // -- Transaction history --------------------------------------------------

  async fetchTransactions(
    address: string,
    page = 0
  ): Promise<ChainTransaction[]> {
    try {
      const response = await fetch(
        `${this.nearblocksApiUrl}/account/${address}/txns?page=${page + 1}&per_page=25&order=desc`
      );
      if (!response.ok) return [];

      const data = await response.json();
      const txns = data.txns || [];

      return txns.map(
        (tx: {
          transaction_hash: string;
          included_in_block_hash?: string;
          block_timestamp: string;
          signer_account_id: string;
          receiver_account_id: string;
          actions?: {
            action: string;
            args?: string | Record<string, string>;
          }[];
          outcomes?: { status: boolean };
        }) => {
          const isSent = tx.signer_account_id === address;

          let amount = 0;
          const transferAction = tx.actions?.find(
            (a) => a.action === "TRANSFER"
          );
          if (transferAction?.args) {
            try {
              const args =
                typeof transferAction.args === "string"
                  ? JSON.parse(transferAction.args)
                  : transferAction.args;
              if (args.deposit) {
                const formatted = formatNearAmount(args.deposit);
                amount = parseFloat(formatted);
              }
            } catch {
              /* ignore parse errors */
            }
          }

          const timestamp = tx.block_timestamp
            ? new Date(
                Number(BigInt(tx.block_timestamp) / BigInt(1000000))
              ).toISOString()
            : new Date().toISOString();

          return {
            id: tx.transaction_hash,
            from: tx.signer_account_id || "",
            to: tx.receiver_account_id || "",
            ticker: NATIVE_TICKER,
            amount,
            fee: 0,
            timestamp,
            status: tx.outcomes?.status ? "completed" : "failed",
            type: isSent ? "sent" : "received",
            blockHash: tx.included_in_block_hash,
          } satisfies ChainTransaction;
        }
      );
    } catch {
      return [];
    }
  }
}
