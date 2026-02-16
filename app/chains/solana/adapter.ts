/**
 * Solana chain adapter.
 *
 * Uses @solana/web3.js (v1) for RPC calls and ed25519-hd-key + @scure/bip39
 * for BIP-44 key derivation from the shared mnemonic.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
import { mnemonicToSeedSync } from "@scure/bip39";

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
  CHAIN_ID,
  NETWORK_NAME,
  NATIVE_TICKER,
  SOL_DECIMALS,
  ICON_URL,
  RPC_URL,
  DERIVATION_PATH,
} from "./config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive an ed25519 Keypair from a BIP-39 mnemonic using BIP-44 path. */
function keypairFromMnemonic(mnemonic: string): Keypair {
  const seed = mnemonicToSeedSync(mnemonic);
  const hexSeed = Buffer.from(seed).toString("hex");
  const derived = derivePath(DERIVATION_PATH, hexSeed);
  return Keypair.fromSeed(derived.key);
}

function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

// ---------------------------------------------------------------------------
// SolanaChainAdapter
// ---------------------------------------------------------------------------

export class SolanaChainAdapter implements ChainAdapter {
  readonly chainId = CHAIN_ID;
  readonly chainName = NETWORK_NAME;
  readonly chainType = "solana" as const;
  readonly nativeTicker = NATIVE_TICKER;
  readonly iconUrl = ICON_URL;

  // -- Account derivation ---------------------------------------------------

  async deriveAddress(mnemonic: string): Promise<string> {
    const kp = keypairFromMnemonic(mnemonic);
    return kp.publicKey.toBase58();
  }

  isValidAddress(address: string): boolean {
    try {
      const pk = new PublicKey(address);
      return PublicKey.isOnCurve(pk.toBytes());
    } catch {
      return false;
    }
  }

  // -- Balances -------------------------------------------------------------

  async fetchBalances(address: string): Promise<ChainCoin[]> {
    const connection = getConnection();
    const coins: ChainCoin[] = [];

    // Native SOL
    const lamports = await connection.getBalance(new PublicKey(address));
    const amount = lamports / LAMPORTS_PER_SOL;

    if (amount > 0) {
      coins.push({
        ticker: NATIVE_TICKER,
        name: "Solana",
        amount,
        decimals: SOL_DECIMALS,
        symbol: ICON_URL,
      });
    }

    // SPL token balances
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(address),
        { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
      );

      for (const { account } of tokenAccounts.value) {
        const parsed = account.data.parsed?.info;
        if (!parsed) continue;

        const tokenAmount = parsed.tokenAmount;
        if (tokenAmount.uiAmount && tokenAmount.uiAmount > 0) {
          coins.push({
            ticker: parsed.mint, // Mint address acts as identifier
            name: parsed.mint,
            amount: tokenAmount.uiAmount,
            decimals: tokenAmount.decimals,
            symbol: "",
            contractAddress: parsed.mint,
          });
        }
      }
    } catch {
      // Token accounts query can fail if the RPC is rate-limited
    }

    return coins;
  }

  // -- Transfers ------------------------------------------------------------

  async estimateFee(params: TransferParams): Promise<ChainFeeEstimate> {
    const connection = getConnection();

    // Build a placeholder transaction to estimate fees
    const sender = new PublicKey(params.senderAddress);
    const recipient = new PublicKey(params.recipientAddress);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: recipient,
        lamports: Math.floor(params.amount * LAMPORTS_PER_SOL),
      })
    );
    tx.feePayer = sender;

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const fee = await tx.getEstimatedFee(connection);
    const feeInSol = (fee ?? 5000) / LAMPORTS_PER_SOL;

    return {
      fee: BigInt(fee ?? 5000),
      feeFormatted: feeInSol.toFixed(9).replace(/\.?0+$/, ""),
      feeTicker: NATIVE_TICKER,
    };
  }

  async sendTransfer(
    params: SignedTransferParams
  ): Promise<ChainTransferResult> {
    try {
      const connection = getConnection();
      const kp = keypairFromMnemonic(params.mnemonic);
      const recipient = new PublicKey(params.recipientAddress);

      const isNative =
        params.ticker === NATIVE_TICKER || !params.tokenIdentifier;

      if (isNative) {
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: kp.publicKey,
            toPubkey: recipient,
            lamports: Math.floor(params.amount * LAMPORTS_PER_SOL),
          })
        );

        const signature = await sendAndConfirmTransaction(connection, tx, [kp]);
        return { success: true, txHash: signature };
      }

      // SPL token transfer
      // Dynamically import to keep the main bundle lighter
      const { getOrCreateAssociatedTokenAccount, transfer } = await import(
        "@solana/spl-token"
      );
      const mint = new PublicKey(params.tokenIdentifier as string);

      const senderATA = await getOrCreateAssociatedTokenAccount(
        connection,
        kp,
        mint,
        kp.publicKey
      );

      const recipientATA = await getOrCreateAssociatedTokenAccount(
        connection,
        kp,
        mint,
        recipient
      );

      // Default to 9 decimals for SPL tokens (caller can provide more precision)
      const decimals = 9;
      const amountRaw = BigInt(
        Math.floor(params.amount * Math.pow(10, decimals))
      );

      const signature = await transfer(
        connection,
        kp,
        senderATA.address,
        recipientATA.address,
        kp,
        amountRaw
      );

      return { success: true, txHash: signature };
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
  ): Promise<ChainTransaction[]> {
    try {
      const connection = getConnection();
      const pubkey = new PublicKey(address);

      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit: 25,
      });

      const transactions: ChainTransaction[] = [];

      for (const sig of signatures) {
        transactions.push({
          id: sig.signature,
          from: address,
          to: "",
          ticker: NATIVE_TICKER,
          amount: 0,
          fee: 0,
          timestamp: sig.blockTime
            ? new Date(sig.blockTime * 1000).toISOString()
            : new Date().toISOString(),
          status: sig.err ? "failed" : "completed",
          type: "sent",
        });
      }

      return transactions;
    } catch {
      return [];
    }
  }
}
