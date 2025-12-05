import { Coin, User, Wallet } from "../types/frontend_type";
import { WALLET_KEY, USER_KEY, POLKADOT_NETWORK_NAME } from "../types/constants";
import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { pah } from "@polkadot-api/descriptors";

// Polkadot Asset Hub WebSocket endpoints
const ASSET_HUB_WS_ENDPOINTS = [
  "wss://polkadot-asset-hub-rpc.polkadot.io",
  "wss://statemint-rpc.dwellir.com",
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
