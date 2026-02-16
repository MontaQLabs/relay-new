/**
 * EVM chain adapter – works for any EVM-compatible chain (Base, Monad, etc.).
 *
 * Uses `viem` for all on-chain interactions. A single class is instantiated
 * with different EVMChainConfig objects to support multiple EVM networks.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  parseUnits,
  isAddress,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";

import type {
  ChainAdapter,
  ChainId,
  ChainCoin,
  ChainFeeEstimate,
  ChainTransferResult,
  ChainTransaction,
  TransferParams,
  SignedTransferParams,
} from "../types";

// ---------------------------------------------------------------------------
// EVM chain configuration
// ---------------------------------------------------------------------------

export interface EVMChainConfig {
  chainId: ChainId;
  chainName: string;
  nativeTicker: string;
  nativeDecimals: number;
  iconUrl: string;
  viemChain: Chain;
  rpcUrl: string;
  blockExplorerApiUrl?: string;
  blockExplorerApiKey?: string;
}

// Minimal ERC-20 ABI for balanceOf and transfer
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ---------------------------------------------------------------------------
// EVMChainAdapter
// ---------------------------------------------------------------------------

export class EVMChainAdapter implements ChainAdapter {
  readonly chainId: ChainId;
  readonly chainName: string;
  readonly chainType = "evm" as const;
  readonly nativeTicker: string;
  readonly iconUrl: string;

  private config: EVMChainConfig;

  constructor(config: EVMChainConfig) {
    this.config = config;
    this.chainId = config.chainId;
    this.chainName = config.chainName;
    this.nativeTicker = config.nativeTicker;
    this.iconUrl = config.iconUrl;
  }

  // -- Helpers --------------------------------------------------------------

  private getPublicClient(): PublicClient<Transport, Chain> {
    return createPublicClient({
      chain: this.config.viemChain,
      transport: http(this.config.rpcUrl),
    });
  }

  // -- Account derivation ---------------------------------------------------

  async deriveAddress(mnemonic: string): Promise<string> {
    const account = mnemonicToAccount(mnemonic);
    return account.address;
  }

  isValidAddress(address: string): boolean {
    return isAddress(address);
  }

  // -- Balances -------------------------------------------------------------

  async fetchBalances(address: string): Promise<ChainCoin[]> {
    const client = this.getPublicClient();
    const coins: ChainCoin[] = [];

    // Native balance
    const balance = await client.getBalance({
      address: address as `0x${string}`,
    });
    const amount = Number(formatEther(balance));

    if (amount > 0) {
      coins.push({
        ticker: this.nativeTicker,
        name: this.chainName,
        amount,
        decimals: this.config.nativeDecimals,
        symbol: this.iconUrl,
      });
    }

    return coins;
  }

  // -- Transfers ------------------------------------------------------------

  async estimateFee(params: TransferParams): Promise<ChainFeeEstimate> {
    const client = this.getPublicClient();

    const isNative =
      params.ticker === this.nativeTicker || !params.tokenIdentifier;

    let gasEstimate: bigint;

    if (isNative) {
      gasEstimate = await client.estimateGas({
        account: params.senderAddress as `0x${string}`,
        to: params.recipientAddress as `0x${string}`,
        value: parseEther(params.amount.toString()),
      });
    } else {
      gasEstimate = await client.estimateGas({
        account: params.senderAddress as `0x${string}`,
        to: params.tokenIdentifier as `0x${string}`,
        data: this.encodeTransferData(
          params.recipientAddress,
          params.amount,
          18
        ),
      });
    }

    const gasPrice = await client.getGasPrice();
    const fee = gasEstimate * gasPrice;
    const feeFormatted = formatEther(fee);

    return {
      fee,
      feeFormatted,
      feeTicker: this.nativeTicker,
    };
  }

  async sendTransfer(
    params: SignedTransferParams
  ): Promise<ChainTransferResult> {
    try {
      const account = mnemonicToAccount(params.mnemonic);
      const client = createWalletClient({
        account,
        chain: this.config.viemChain,
        transport: http(this.config.rpcUrl),
      });

      const isNative =
        params.ticker === this.nativeTicker || !params.tokenIdentifier;

      let txHash: `0x${string}`;

      if (isNative) {
        txHash = await client.sendTransaction({
          to: params.recipientAddress as `0x${string}`,
          value: parseEther(params.amount.toString()),
        });
      } else {
        // ERC-20 transfer
        const tokenAddress = params.tokenIdentifier as string;
        const publicClient = this.getPublicClient();

        // Read token decimals
        const decimals = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "decimals",
        });

        txHash = await client.sendTransaction({
          to: tokenAddress as `0x${string}`,
          data: this.encodeTransferData(
            params.recipientAddress,
            params.amount,
            decimals
          ),
        });
      }

      // Wait for receipt
      const publicClient = this.getPublicClient();
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      return {
        success: receipt.status === "success",
        txHash,
        blockHash: receipt.blockHash,
      };
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
    // Block explorer API integration varies per chain.
    // For Base, Basescan provides an Etherscan-compatible API.
    // For Monad, this may need to be updated once their explorer is live.
    if (!this.config.blockExplorerApiUrl) return [];

    try {
      const offset = 25;
      const url = new URL(`${this.config.blockExplorerApiUrl}`);
      url.searchParams.set("module", "account");
      url.searchParams.set("action", "txlist");
      url.searchParams.set("address", address);
      url.searchParams.set("startblock", "0");
      url.searchParams.set("endblock", "99999999");
      url.searchParams.set("page", String(page + 1));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("sort", "desc");
      if (this.config.blockExplorerApiKey) {
        url.searchParams.set("apikey", this.config.blockExplorerApiKey);
      }

      const response = await fetch(url.toString());
      if (!response.ok) return [];

      const data = await response.json();
      if (data.status !== "1" || !Array.isArray(data.result)) return [];

      return data.result.map(
        (tx: {
          hash: string;
          from: string;
          to: string;
          value: string;
          gasUsed: string;
          gasPrice: string;
          timeStamp: string;
          isError: string;
        }) => {
          const isSent = tx.from.toLowerCase() === address.toLowerCase();
          const amount = Number(formatEther(BigInt(tx.value)));
          const fee =
            Number(formatEther(BigInt(tx.gasUsed) * BigInt(tx.gasPrice)));
          return {
            id: tx.hash,
            from: tx.from,
            to: tx.to,
            ticker: this.nativeTicker,
            amount,
            fee,
            timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
            status: tx.isError === "0" ? "completed" : "failed",
            type: isSent ? "sent" : "received",
            blockHash: tx.hash,
          } satisfies ChainTransaction;
        }
      );
    } catch {
      return [];
    }
  }

  // -- Internal helpers -----------------------------------------------------

  private encodeTransferData(
    to: string,
    amount: number,
    decimals: number
  ): `0x${string}` {
    // ERC-20 transfer(address,uint256) selector = 0xa9059cbb
    const amountWei = parseUnits(amount.toString(), decimals);
    const paddedTo = to.slice(2).toLowerCase().padStart(64, "0");
    const paddedAmount = amountWei.toString(16).padStart(64, "0");
    return `0xa9059cbb${paddedTo}${paddedAmount}` as `0x${string}`;
  }
}
