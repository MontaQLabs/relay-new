import { Coin, User, Wallet, KnownAsset } from "../types/frontend_type";
import { WALLET_KEY, USER_KEY, POLKADOT_NETWORK_NAME, WALLET_SEED_KEY } from "../types/constants";
import { createClient, PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { pah } from "@polkadot-api/descriptors";
import { getPolkadotSigner } from "@polkadot-api/signer";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { SS58_FORMAT } from "../types/constants";

// CoinGecko API endpoint for price fetching
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";

// Mapping from ticker symbols to CoinGecko IDs
const TICKER_TO_COINGECKO_ID: Record<string, string> = {
  DOT: "polkadot",
  USDt: "tether",
  USDT: "tether",
  USDC: "usd-coin",
  DED: "ded",
  PINK: "pink",
  ETH: "ethereum",
  BTC: "bitcoin",
  SOL: "solana",
  XMR: "monero",
  ZEC: "zcash",
  ETC: "ethereum-classic",
  RMRK: "rmrk",
  // Add more mappings as needed
};

// Price data returned from the API
export interface TokenPrice {
  usd: number;
  usd_24h_change?: number;
}

// Price map type: ticker -> price info
export type PriceMap = Record<string, TokenPrice>;

/**
 * Fetches real-time USD prices for the given token tickers from CoinGecko API
 * Returns a map of ticker -> { usd: price, usd_24h_change: change }
 * If a token price is unavailable, it won't be included in the result
 * 
 * @param tickers - Array of token ticker symbols (e.g., ["DOT", "USDt", "USDC"])
 * @returns Promise<PriceMap> - Map of ticker to price info
 */
export const fetchTokenPrices = async (tickers: string[]): Promise<PriceMap> => {
  if (tickers.length === 0) return {};

  try {
    // Convert tickers to CoinGecko IDs
    const coinGeckoIds: string[] = [];
    const tickerToIdMap = new Map<string, string>();

    for (const ticker of tickers) {
      const coinGeckoId = TICKER_TO_COINGECKO_ID[ticker];
      if (coinGeckoId && !coinGeckoIds.includes(coinGeckoId)) {
        coinGeckoIds.push(coinGeckoId);
        tickerToIdMap.set(ticker, coinGeckoId);
      }
    }

    if (coinGeckoIds.length === 0) {
      // No known CoinGecko IDs, return stablecoin defaults
      return getStablecoinDefaults(tickers);
    }

    // Fetch prices from CoinGecko
    const url = `${COINGECKO_API_URL}?ids=${coinGeckoIds.join(",")}&vs_currencies=usd&include_24hr_change=true`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Failed to fetch prices from CoinGecko:", response.statusText);
      return getStablecoinDefaults(tickers);
    }

    const data = await response.json();

    // Build result map with original tickers
    const priceMap: PriceMap = {};

    for (const ticker of tickers) {
      const coinGeckoId = tickerToIdMap.get(ticker);
      
      if (coinGeckoId && data[coinGeckoId]) {
        priceMap[ticker] = {
          usd: data[coinGeckoId].usd ?? 0,
          usd_24h_change: data[coinGeckoId].usd_24h_change,
        };
      } else if (isStablecoin(ticker)) {
        // Default stablecoins to $1
        priceMap[ticker] = { usd: 1, usd_24h_change: 0 };
      }
    }

    return priceMap;
  } catch (error) {
    console.error("Error fetching token prices:", error);
    return getStablecoinDefaults(tickers);
  }
};

/**
 * Checks if a ticker is a stablecoin
 */
const isStablecoin = (ticker: string): boolean => {
  const stablecoins = ["USDt", "USDT", "USDC", "DAI", "BUSD", "TUSD", "USDP"];
  return stablecoins.includes(ticker);
};

/**
 * Returns default prices for stablecoins when API is unavailable
 */
const getStablecoinDefaults = (tickers: string[]): PriceMap => {
  const priceMap: PriceMap = {};
  for (const ticker of tickers) {
    if (isStablecoin(ticker)) {
      priceMap[ticker] = { usd: 1, usd_24h_change: 0 };
    }
  }
  return priceMap;
};

/**
 * Gets the USD price for a single token
 * Returns 0 if price is unavailable
 * 
 * @param ticker - Token ticker symbol
 * @returns Promise<number> - USD price
 */
export const getTokenPrice = async (ticker: string): Promise<number> => {
  const prices = await fetchTokenPrices([ticker]);
  return prices[ticker]?.usd ?? 0;
};

/**
 * Calculates the total USD value of a coin portfolio
 * Uses real-time prices from CoinGecko API
 * If a coin's price is unavailable, uses 0 for that coin
 * 
 * @param coins - Array of coins with amounts
 * @returns Promise<{ totalValue: number; coinsWithPrices: Coin[] }> - Total USD value and coins with updated fiat values
 */
export const calculatePortfolioValue = async (
  coins: Coin[]
): Promise<{ totalValue: number; coinsWithPrices: Coin[] }> => {
  if (coins.length === 0) {
    return { totalValue: 0, coinsWithPrices: [] };
  }

  // Get all tickers
  const tickers = coins.map((coin) => coin.ticker);

  // Fetch prices for all tickers
  const prices = await fetchTokenPrices(tickers);

  // Calculate values for each coin
  let totalValue = 0;
  const coinsWithPrices: Coin[] = coins.map((coin) => {
    const price = prices[coin.ticker]?.usd ?? 0;
    const fiatValue = coin.amount * price;
    const change = prices[coin.ticker]?.usd_24h_change ?? 0;

    totalValue += fiatValue;

    return {
      ...coin,
      fiatValue,
      change,
    };
  });

  return { totalValue, coinsWithPrices };
};

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

// Asset details returned from Polkadot Asset Hub
export interface AssetDetails {
  assetId: number;
  ticker: string;
  name: string;
  symbol: string; // Icon URL
  decimals: number;
  owner: string;
  issuer: string;
  admin: string;
  freezer: string;
  supply: string;
  minBalance: string;
  accounts: number;
  isFrozen: boolean;
  isSufficient: boolean;
}

// DOT decimals on Polkadot Asset Hub
const DOT_DECIMALS = 10;

/**
 * Fetches all coins owned by the user on Polkadot Asset Hub
 * Queries native DOT balance and known assets from the provided list
 * Saves the result to localStorage under USER_KEY
 * 
 * @param knownAssets - Array of known assets to query balances for (fetched from Supabase)
 * @returns Promise<Coin[]> - Array of coins owned by the user
 */
export const fetchDotCoins = async (knownAssets: KnownAsset[]): Promise<Coin[]> => {
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
    for (const asset of knownAssets) {
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
              fiatValue: asset.ticker === "USDt" || asset.ticker === "USDC" ? amount : 0, // Stablecoins are ~$1
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
 * @param knownAssets - Array of known assets to search in
 * @returns Asset ID or undefined for native DOT
 */
const getAssetId = (ticker: string, knownAssets: KnownAsset[]): number | undefined => {
  const asset = knownAssets.find(a => a.ticker === ticker);
  return asset?.id;
};

/**
 * Gets decimals for a given ticker symbol
 * 
 * @param ticker - The asset ticker symbol
 * @param knownAssets - Array of known assets to search in
 * @returns Decimals for the asset
 */
const getDecimals = (ticker: string, knownAssets: KnownAsset[]): number => {
  if (ticker === "DOT") return DOT_DECIMALS;
  const asset = knownAssets.find(a => a.ticker === ticker);
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
 * @param knownAssets - Array of known assets (fetched from Supabase)
 * @returns Promise<FeeEstimate> - Estimated fee information
 */
export const estimateTransferFee = async (
  senderAddress: string,
  recipientAddress: string,
  ticker: string,
  amount: number,
  knownAssets: KnownAsset[]
): Promise<FeeEstimate> => {
  // Create WebSocket provider and client
  const provider = getWsProvider(ASSET_HUB_WS_ENDPOINTS);
  const client: PolkadotClient = createClient(provider);

  try {
    // Get typed API for Polkadot Asset Hub
    const api = client.getTypedApi(pah);

    // Convert amount to smallest unit
    const decimals = getDecimals(ticker, knownAssets);
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
      const assetId = getAssetId(ticker, knownAssets);
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
 * @param knownAssets - Array of known assets (fetched from Supabase)
 * @returns Promise<TransferResult> - Result of the transfer operation
 */
export const sendTransfer = async (
  recipientAddress: string,
  ticker: string,
  network: string,
  amount: number,
  knownAssets: KnownAsset[]
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
    const decimals = getDecimals(ticker, knownAssets);
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
      const assetId = getAssetId(ticker, knownAssets);
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

/**
 * Fetches detailed information about an asset from Polkadot Asset Hub
 * Queries the Assets pallet for metadata and asset details
 * 
 * @param assetId - The numeric asset ID on Polkadot Asset Hub
 * @param iconUrl - Optional icon URL for the asset (from Supabase known_assets)
 * @param knownAsset - Optional known asset info for fallback values
 * @returns Promise<AssetDetails | null> - Detailed asset information or null if not found
 */
export const fetchAssetDetails = async (
  assetId: number, 
  iconUrl?: string,
  knownAsset?: KnownAsset
): Promise<AssetDetails | null> => {
  // Create WebSocket provider and client
  const provider = getWsProvider(ASSET_HUB_WS_ENDPOINTS);
  const client = createClient(provider);

  try {
    // Get typed API for Polkadot Asset Hub
    const api = client.getTypedApi(pah);

    // Query asset details from Assets.Asset
    const assetInfo = await api.query.Assets.Asset.getValue(assetId);
    
    if (!assetInfo) {
      console.log(`Asset ${assetId} not found`);
      return null;
    }

    // Query asset metadata from Assets.Metadata
    const metadata = await api.query.Assets.Metadata.getValue(assetId);
    
    // Decode the Binary fields to strings
    const name = metadata?.name ? new TextDecoder().decode(metadata.name.asBytes()) : knownAsset?.ticker || "Unknown";
    const ticker = metadata?.symbol ? new TextDecoder().decode(metadata.symbol.asBytes()) : knownAsset?.ticker || "???";
    const decimals = metadata?.decimals ?? knownAsset?.decimals ?? 10;

    // Format supply with decimals
    const supplyRaw = assetInfo.supply;
    const supplyFormatted = (Number(supplyRaw) / Math.pow(10, decimals)).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });

    // Format min balance
    const minBalanceRaw = assetInfo.min_balance;
    const minBalanceFormatted = (Number(minBalanceRaw) / Math.pow(10, decimals)).toString();

    return {
      assetId,
      ticker,
      name,
      symbol: iconUrl || knownAsset?.symbol || "",
      decimals,
      owner: assetInfo.owner,
      issuer: assetInfo.issuer,
      admin: assetInfo.admin,
      freezer: assetInfo.freezer,
      supply: supplyFormatted,
      minBalance: minBalanceFormatted,
      accounts: assetInfo.accounts,
      isFrozen: assetInfo.status.type === "Frozen",
      isSufficient: assetInfo.is_sufficient,
    };
  } catch (error) {
    console.error("Failed to fetch asset details:", error);
    return null;
  } finally {
    // Destroy the client to clean up WebSocket connection
    client.destroy();
  }
};
