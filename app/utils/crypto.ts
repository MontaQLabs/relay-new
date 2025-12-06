import { Coin, User, Wallet } from "../types/frontend_type";
import { WALLET_KEY, USER_KEY, POLKADOT_NETWORK_NAME, WALLET_SEED_KEY } from "../types/constants";
import { createClient, PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { pah } from "@polkadot-api/descriptors";
import { getPolkadotSigner } from "@polkadot-api/signer";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { SS58_FORMAT } from "../types/constants";

// Re-export types used by the fee estimation
export interface FeeEstimate {
  fee: bigint;        // Fee in smallest unit (planck for DOT, or asset decimals)
  feeFormatted: string; // Human-readable fee
  feeTicker: string;    // The ticker of the fee currency (always DOT for Asset Hub)
}

// Result type for transfer operations
export interface TransferResult {
  success: boolean;
  txHash?: string;
  blockHash?: string;
  error?: string;
}

// Polkadot Asset Hub WebSocket endpoints
const ASSET_HUB_WS_ENDPOINTS = [
  "wss://polkadot-asset-hub-rpc.polkadot.io",
  "wss://statemint.api.onfinality.io/public-ws",
];

// Known asset IDs on Polkadot Asset Hub
// Reference: https://assethub-polkadot.subscan.io/assets
const KNOWN_ASSETS = [
  { id: 1984, ticker: "USDT", decimals: 6, symbol: "https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  { id: 1337, ticker: "USDC", decimals: 6, symbol: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
];

// DOT decimals on Polkadot Asset Hub
const DOT_DECIMALS = 10;

/**
 * Fetches all coins owned by the user on Polkadot Asset Hub
 * Queries native DOT balance and known assets (USDT, USDC)
 * Saves the result to localStorage under USER_KEY
 * 
 * @returns Promise<Coin[]> - Array of coins owned by the user
 */
export const fetchDotCoins = async (): Promise<Coin[]> => {
  if (typeof window === "undefined") return [];

  // Get wallet address from localStorage
  const walletData = localStorage.getItem(WALLET_KEY);
  if (!walletData) {
    console.error("No wallet found in localStorage");
    return [];
  }

  let wallet: Wallet;
  try {
    wallet = JSON.parse(walletData) as Wallet;
  } catch {
    console.error("Failed to parse wallet data");
    return [];
  }

  const address = wallet.address;
  if (!address) {
    console.error("Wallet has no address");
    return [];
  }

  const coins: Coin[] = [];

  // Create WebSocket provider and client
  const provider = getWsProvider(ASSET_HUB_WS_ENDPOINTS);
  const client = createClient(provider);

  try {
    // Get typed API for Polkadot Asset Hub
    const api = client.getTypedApi(pah);

    // Query native DOT balance from System.Account
    const accountInfo = await api.query.System.Account.getValue(address);
    const freeBalance = accountInfo.data.free;

    // Convert from Planck (10^10) to DOT
    const dotAmount = Number(freeBalance) / Math.pow(10, DOT_DECIMALS);

    if (dotAmount > 0) {
      coins.push({
        ticker: "DOT",
        amount: dotAmount,
        change: 0, // Would need price API for real change data
        symbol: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
        fiatValue: 0, // Would need price API for fiat value
      });
    }

    // Query known assets from Assets pallet
    for (const asset of KNOWN_ASSETS) {
      try {
        const assetAccount = await api.query.Assets.Account.getValue(asset.id, address);
        
        if (assetAccount) {
          const assetBalance = assetAccount.balance;
          const amount = Number(assetBalance) / Math.pow(10, asset.decimals);

          if (amount > 0) {
            coins.push({
              ticker: asset.ticker,
              amount: amount,
              change: 0, // Would need price API for real change data
              symbol: asset.symbol,
              fiatValue: asset.ticker === "USDT" || asset.ticker === "USDC" ? amount : 0, // Stablecoins are ~$1
            });
          }
        }
      } catch {
        // Asset account doesn't exist for this user (no balance)
        console.log(`No ${asset.ticker} balance for address ${address}`);
      }
    }

    // Update the user data in localStorage with the fetched coins
    updateUserCoins(coins);

    return coins;
  } catch (error) {
    console.error("Failed to fetch coins:", error);
    return [];
  } finally {
    // Destroy the client to clean up WebSocket connection
    client.destroy();
  }
};

/**
 * Gets asset ID for a given ticker symbol on Polkadot Asset Hub
 * Returns undefined for native DOT
 * 
 * @param ticker - The asset ticker symbol (e.g., "USDT", "USDC", "DOT")
 * @returns Asset ID or undefined for native DOT
 */
const getAssetId = (ticker: string): number | undefined => {
  const asset = KNOWN_ASSETS.find(a => a.ticker === ticker);
  return asset?.id;
};

/**
 * Gets decimals for a given ticker symbol
 * 
 * @param ticker - The asset ticker symbol
 * @returns Decimals for the asset
 */
const getDecimals = (ticker: string): number => {
  if (ticker === "DOT") return DOT_DECIMALS;
  const asset = KNOWN_ASSETS.find(a => a.ticker === ticker);
  return asset?.decimals ?? 6;
};

/**
 * Estimates transaction fees for a transfer on Polkadot Asset Hub
 * Uses PAPI's getEstimatedFees method to calculate fees
 * 
 * @param senderAddress - The address sending the transfer
 * @param recipientAddress - The address receiving the transfer  
 * @param ticker - The asset ticker symbol (e.g., "DOT", "USDT", "USDC")
 * @param amount - The amount to transfer (in human-readable units)
 * @returns Promise<FeeEstimate> - Estimated fee information
 */
export const estimateTransferFee = async (
  senderAddress: string,
  recipientAddress: string,
  ticker: string,
  amount: number
): Promise<FeeEstimate> => {
  // Create WebSocket provider and client
  const provider = getWsProvider(ASSET_HUB_WS_ENDPOINTS);
  const client: PolkadotClient = createClient(provider);

  try {
    // Get typed API for Polkadot Asset Hub
    const api = client.getTypedApi(pah);

    // Convert amount to smallest unit
    const decimals = getDecimals(ticker);
    const amountInSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    let tx;

    if (ticker === "DOT") {
      // Native DOT transfer using Balances pallet
      tx = api.tx.Balances.transfer_keep_alive({
        dest: { type: "Id", value: recipientAddress },
        value: amountInSmallestUnit,
      });
    } else {
      // Asset transfer using Assets pallet (USDT, USDC, etc.)
      const assetId = getAssetId(ticker);
      if (assetId === undefined) {
        throw new Error(`Unknown asset ticker: ${ticker}`);
      }
      
      tx = api.tx.Assets.transfer_keep_alive({
        id: assetId,
        target: { type: "Id", value: recipientAddress },
        amount: amountInSmallestUnit,
      });
    }

    // Estimate the fees for this transaction
    // Fees on Asset Hub are always paid in DOT
    const estimatedFee = await tx.getEstimatedFees(senderAddress);

    // Format the fee in DOT (10 decimals)
    const feeInDot = Number(estimatedFee) / Math.pow(10, DOT_DECIMALS);
    
    // Format with appropriate precision (show more decimals for small fees)
    let feeFormatted: string;
    if (feeInDot < 0.0001) {
      feeFormatted = feeInDot.toFixed(8);
    } else if (feeInDot < 0.01) {
      feeFormatted = feeInDot.toFixed(6);
    } else {
      feeFormatted = feeInDot.toFixed(4);
    }

    // Remove trailing zeros
    feeFormatted = feeFormatted.replace(/\.?0+$/, "");

    return {
      fee: estimatedFee,
      feeFormatted,
      feeTicker: "DOT",
    };
  } catch (error) {
    console.error("Failed to estimate transfer fee:", error);
    throw error;
  } finally {
    // Destroy the client to clean up WebSocket connection
    client.destroy();
  }
};

/**
 * Updates the coins field in the User object stored in localStorage
 * 
 * @param coins - Array of coins to save
 */
const updateUserCoins = (coins: Coin[]): void => {
  if (typeof window === "undefined") return;

  try {
    // Get existing user data or create new
    const existingUserData = localStorage.getItem(USER_KEY);
    let user: User;

    if (existingUserData) {
      user = JSON.parse(existingUserData) as User;
    } else {
      // Create minimal user object if none exists
      const walletData = localStorage.getItem(WALLET_KEY);
      const wallet: Wallet = walletData 
        ? JSON.parse(walletData) 
        : { address: "", network: POLKADOT_NETWORK_NAME, status: "inactive", isBackedUp: false };

      user = {
        avatar: "",
        nickname: "",
        wallet: wallet,
        friends: [],
        socialRecovery: [],
        transactions: [],
        communities: [],
        activities: [],
      };
    }

    // Update coins in the wallet
    user.wallet.coins = coins;

    // Save updated user data to localStorage
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Failed to update user coins in localStorage:", error);
  }
};

/**
 * Sends a transfer transaction on Polkadot Asset Hub
 * Uses PAPI to create, sign, and submit the transaction
 * 
 * @param recipientAddress - The address receiving the transfer
 * @param ticker - The asset ticker symbol (e.g., "DOT", "USDT", "USDC")
 * @param network - The network to send on (currently only Asset Hub supported)
 * @param amount - The amount to transfer (in human-readable units)
 * @returns Promise<TransferResult> - Result of the transfer operation
 */
export const sendTransfer = async (
  recipientAddress: string,
  ticker: string,
  network: string,
  amount: number
): Promise<TransferResult> => {
  // Ensure WASM crypto is ready (required for sr25519)
  await cryptoWaitReady();

  // Get mnemonic from localStorage
  const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
  if (!mnemonic) {
    return {
      success: false,
      error: "Wallet seed not found. Please unlock your wallet first.",
    };
  }

  // Create keyring and add keypair from mnemonic
  const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
  const keypair = keyring.addFromMnemonic(mnemonic);

  // Create WebSocket provider and client
  const provider = getWsProvider(ASSET_HUB_WS_ENDPOINTS);
  const client: PolkadotClient = createClient(provider);

  try {
    // Get typed API for Polkadot Asset Hub
    const api = client.getTypedApi(pah);

    // Convert amount to smallest unit
    const decimals = getDecimals(ticker);
    const amountInSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    let tx;

    if (ticker === "DOT") {
      // Native DOT transfer using Balances pallet
      tx = api.tx.Balances.transfer_keep_alive({
        dest: { type: "Id", value: recipientAddress },
        value: amountInSmallestUnit,
      });
    } else {
      // Asset transfer using Assets pallet (USDT, USDC, etc.)
      const assetId = getAssetId(ticker);
      if (assetId === undefined) {
        return {
          success: false,
          error: `Unknown asset ticker: ${ticker}`,
        };
      }
      
      tx = api.tx.Assets.transfer_keep_alive({
        id: assetId,
        target: { type: "Id", value: recipientAddress },
        amount: amountInSmallestUnit,
      });
    }

    // Create a PAPI-compatible signer from the keypair
    const signer = getPolkadotSigner(
      keypair.publicKey,
      "Sr25519",
      (input) => keypair.sign(input)
    );

    // Sign and submit the transaction
    const result = await tx.signAndSubmit(signer);

    return {
      success: true,
      txHash: result.txHash,
      blockHash: result.block.hash,
    };
  } catch (error) {
    console.error("Failed to send transfer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  } finally {
    // Destroy the client to clean up WebSocket connection
    client.destroy();
  }
};
