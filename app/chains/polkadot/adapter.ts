/**
 * Polkadot Asset Hub chain adapter.
 *
 * Wraps the existing Polkadot integration (polkadot-api, @polkadot/keyring)
 * behind the ChainAdapter interface so it participates in the multi-chain
 * registry alongside EVM and Solana adapters.
 */

import { Keyring } from "@polkadot/keyring";
import {
  cryptoWaitReady,
  mnemonicValidate,
  decodeAddress,
  encodeAddress,
} from "@polkadot/util-crypto";
import { createClient, type PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { pah } from "@polkadot-api/descriptors";
import { getPolkadotSigner } from "@polkadot-api/signer";

import type {
  ChainAdapter,
  ChainCoin,
  ChainFeeEstimate,
  ChainTransferResult,
  ChainTransaction,
  TransferParams,
  SignedTransferParams,
} from "../types";

import {
  SS58_FORMAT,
  NETWORK_NAME,
  CHAIN_ID,
  NATIVE_TICKER,
  DOT_DECIMALS,
  ICON_URL,
  WS_ENDPOINTS,
  SUBSCAN_API_URL,
} from "./config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a short-lived WebSocket client. Caller MUST call client.destroy(). */
function createPahClient(): PolkadotClient {
  const provider = getWsProvider(WS_ENDPOINTS);
  return createClient(provider);
}

// ---------------------------------------------------------------------------
// PolkadotChainAdapter
// ---------------------------------------------------------------------------

export class PolkadotChainAdapter implements ChainAdapter {
  readonly chainId = CHAIN_ID;
  readonly chainName = NETWORK_NAME;
  readonly chainType = "substrate" as const;
  readonly nativeTicker = NATIVE_TICKER;
  readonly iconUrl = ICON_URL;

  // -- Account derivation ---------------------------------------------------

  async deriveAddress(mnemonic: string): Promise<string> {
    await cryptoWaitReady();
    const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
    const pair = keyring.addFromMnemonic(mnemonic);
    return pair.address;
  }

  isValidAddress(address: string): boolean {
    if (!address || address.trim() === "") return false;
    try {
      const decoded = decodeAddress(address);
      encodeAddress(decoded);
      return true;
    } catch {
      return false;
    }
  }

  // -- Balances -------------------------------------------------------------

  async fetchBalances(address: string): Promise<ChainCoin[]> {
    const client = createPahClient();
    try {
      const api = client.getTypedApi(pah);
      const coins: ChainCoin[] = [];

      // Native DOT balance
      const accountInfo = await api.query.System.Account.getValue(address);
      const dotAmount =
        Number(accountInfo.data.free) / Math.pow(10, DOT_DECIMALS);

      if (dotAmount > 0) {
        coins.push({
          ticker: NATIVE_TICKER,
          name: "Polkadot",
          amount: dotAmount,
          decimals: DOT_DECIMALS,
          symbol: ICON_URL,
        });
      }

      return coins;
    } finally {
      client.destroy();
    }
  }

  // -- Transfers ------------------------------------------------------------

  async estimateFee(params: TransferParams): Promise<ChainFeeEstimate> {
    const client = createPahClient();
    try {
      const api = client.getTypedApi(pah);
      const decimals =
        params.ticker === NATIVE_TICKER
          ? DOT_DECIMALS
          : typeof params.tokenIdentifier === "number"
            ? 6
            : DOT_DECIMALS;
      const amountSmallest = BigInt(
        Math.floor(params.amount * Math.pow(10, decimals))
      );

      let tx;
      if (params.ticker === NATIVE_TICKER) {
        tx = api.tx.Balances.transfer_keep_alive({
          dest: { type: "Id", value: params.recipientAddress },
          value: amountSmallest,
        });
      } else {
        const assetId = params.tokenIdentifier as number;
        if (assetId === undefined) {
          throw new Error(`Unknown asset ticker: ${params.ticker}`);
        }
        tx = api.tx.Assets.transfer_keep_alive({
          id: assetId,
          target: { type: "Id", value: params.recipientAddress },
          amount: amountSmallest,
        });
      }

      const estimatedFee = await tx.getEstimatedFees(params.senderAddress);
      const feeInDot = Number(estimatedFee) / Math.pow(10, DOT_DECIMALS);

      let feeFormatted: string;
      if (feeInDot < 0.0001) feeFormatted = feeInDot.toFixed(8);
      else if (feeInDot < 0.01) feeFormatted = feeInDot.toFixed(6);
      else feeFormatted = feeInDot.toFixed(4);
      feeFormatted = feeFormatted.replace(/\.?0+$/, "");

      return { fee: estimatedFee, feeFormatted, feeTicker: NATIVE_TICKER };
    } finally {
      client.destroy();
    }
  }

  async sendTransfer(
    params: SignedTransferParams
  ): Promise<ChainTransferResult> {
    await cryptoWaitReady();

    const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
    const keypair = keyring.addFromMnemonic(params.mnemonic);

    const client = createPahClient();
    try {
      const api = client.getTypedApi(pah);
      const decimals =
        params.ticker === NATIVE_TICKER
          ? DOT_DECIMALS
          : typeof params.tokenIdentifier === "number"
            ? 6
            : DOT_DECIMALS;
      const amountSmallest = BigInt(
        Math.floor(params.amount * Math.pow(10, decimals))
      );

      let tx;
      if (params.ticker === NATIVE_TICKER) {
        tx = api.tx.Balances.transfer_keep_alive({
          dest: { type: "Id", value: params.recipientAddress },
          value: amountSmallest,
        });
      } else {
        const assetId = params.tokenIdentifier as number;
        if (assetId === undefined) {
          return { success: false, error: `Unknown asset: ${params.ticker}` };
        }
        tx = api.tx.Assets.transfer_keep_alive({
          id: assetId,
          target: { type: "Id", value: params.recipientAddress },
          amount: amountSmallest,
        });
      }

      const signer = getPolkadotSigner(
        keypair.publicKey,
        "Sr25519",
        (input) => keypair.sign(input)
      );
      const result = await tx.signAndSubmit(signer);

      return {
        success: true,
        txHash: result.txHash,
        blockHash: result.block.hash,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      };
    } finally {
      client.destroy();
    }
  }

  // -- Transaction history --------------------------------------------------

  async fetchTransactions(
    address: string,
    page = 0
  ): Promise<ChainTransaction[]> {
    try {
      const response = await fetch(
        `${SUBSCAN_API_URL}/api/v2/scan/transfers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            row: 25,
            page,
            direction: "all",
          }),
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      if (data.code !== 0) return [];

      const transfers = data.data?.transfers || [];
      return transfers.map(
        (t: {
          hash: string;
          from: string;
          to: string;
          asset_symbol: string;
          amount_v2: string;
          amount: string;
          fee: string;
          block_timestamp: number;
          success: boolean;
        }) => {
          const isSent = t.from.toLowerCase() === address.toLowerCase();
          const decimals = t.asset_symbol === "DOT" ? 10 : 6;
          return {
            id: t.hash,
            from: t.from,
            to: t.to,
            ticker: t.asset_symbol || "DOT",
            amount:
              parseFloat(t.amount_v2 || t.amount) / Math.pow(10, decimals),
            fee: parseFloat(t.fee) / Math.pow(10, 10),
            timestamp: new Date(t.block_timestamp * 1000).toISOString(),
            status: t.success ? "completed" : "failed",
            type: isSent ? "sent" : "received",
            blockHash: t.hash,
          } satisfies ChainTransaction;
        }
      );
    } catch {
      return [];
    }
  }
}
