import { createClient, PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { createStakingSdk, StakingSdk } from "@polkadot-api/sdk-staking";
import { pah } from "@polkadot-api/descriptors";
import { getPolkadotSigner } from "@polkadot-api/signer";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { WALLET_KEY, WALLET_SEED_KEY, SS58_FORMAT } from "../types/constants";
import type {
  NominationPoolInfo,
  PoolSummary,
  PoolDetails,
  PaginatedPoolSummaries,
  StakingAccountStatus,
  StakingTransactionResult,
  Wallet,
} from "../types/frontend_type";

// Polkadot Asset Hub WebSocket endpoints
// Using public Parity endpoint first (no rate limits) with OnFinality as fallback
const ASSET_HUB_WS_ENDPOINTS = [
  "wss://polkadot-asset-hub-rpc.polkadot.io",
  "wss://statemint.api.onfinality.io/ws?apikey=15e1e599-9329-42ea-a32c-3b486e5a709c",
];

// Cache keys for localStorage
const POOLS_CACHE_KEY = "staking_pools_cache";
const POOLS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

// DOT decimals on Polkadot
const DOT_DECIMALS = 10;

// ===== Singleton Client Management =====
// The SDK has a per-era caching mechanism that is reused across requests.
// We maintain a persistent client to take advantage of this caching.

let cachedClient: PolkadotClient | null = null;
let cachedStakingSdk: StakingSdk | null = null;
let cachedTypedApi: ReturnType<PolkadotClient["getTypedApi"]> | null = null;

/**
 * Gets or creates a persistent staking client with caching
 * The SDK's per-era caching mechanism is preserved across calls
 */
const getStakingClient = () => {
  if (!cachedClient) {
    const provider = getWsProvider(ASSET_HUB_WS_ENDPOINTS);
    cachedClient = createClient(provider);
    cachedStakingSdk = createStakingSdk(cachedClient);
    cachedTypedApi = cachedClient.getTypedApi(pah);
  }
  return {
    client: cachedClient,
    stakingSdk: cachedStakingSdk!,
    typedApi: cachedTypedApi!,
  };
};

/**
 * Destroys the cached client and clears the cache
 * Call this when the user logs out or the app is unmounted
 */
export const destroyStakingClient = () => {
  if (cachedClient) {
    cachedClient.destroy();
    cachedClient = null;
    cachedStakingSdk = null;
    cachedTypedApi = null;
  }
};

/**
 * Creates a NEW client for one-time transactional operations
 * Use this for operations that modify state (join, unbond, etc.)
 * These should be destroyed after use to avoid connection leaks
 */
const createTransactionClient = () => {
  const provider = getWsProvider(ASSET_HUB_WS_ENDPOINTS);
  const client = createClient(provider);
  const stakingSdk = createStakingSdk(client);
  const typedApi = client.getTypedApi(pah);
  return { client, stakingSdk, typedApi };
};

/**
 * Gets the wallet address from localStorage
 */
const getWalletAddress = (): string | null => {
  if (typeof window === "undefined") return null;

  const walletData = localStorage.getItem(WALLET_KEY);
  if (!walletData) return null;

  try {
    const wallet = JSON.parse(walletData) as Wallet;
    return wallet.address || null;
  } catch {
    return null;
  }
};

/**
 * Gets cached pools from localStorage if still valid
 */
const getCachedPools = (): NominationPoolInfo[] | null => {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(POOLS_CACHE_KEY);
    if (!cached) return null;

    const { pools, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > POOLS_CACHE_TTL;

    if (isExpired) {
      localStorage.removeItem(POOLS_CACHE_KEY);
      return null;
    }

    return pools as NominationPoolInfo[];
  } catch {
    return null;
  }
};

/**
 * Saves pools to localStorage cache
 */
const setCachedPools = (pools: NominationPoolInfo[]): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      POOLS_CACHE_KEY,
      JSON.stringify({ pools, timestamp: Date.now() })
    );
  } catch (error) {
    console.error("Failed to cache pools:", error);
  }
};

// ===== Lazy Loading: Pool Summaries =====
const POOL_SUMMARIES_CACHE_KEY = "staking_pool_summaries_cache";
const POOL_INDEX_CACHE_KEY = "staking_pool_index_cache";
const POOL_SUMMARIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Minimal pool data for index (fast to fetch and cache)
 */
interface PoolIndexEntry {
  id: number;
  state: "Open" | "Blocked" | "Destroying";
  memberCount: number;
}

/**
 * Gets cached pool index from localStorage if still valid
 */
const getCachedPoolIndex = (): PoolIndexEntry[] | null => {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(POOL_INDEX_CACHE_KEY);
    if (!cached) return null;

    const { pools, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > POOL_SUMMARIES_CACHE_TTL;

    if (isExpired) {
      localStorage.removeItem(POOL_INDEX_CACHE_KEY);
      return null;
    }

    return pools as PoolIndexEntry[];
  } catch {
    return null;
  }
};

/**
 * Saves pool index to localStorage cache
 */
const setCachedPoolIndex = (pools: PoolIndexEntry[]): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      POOL_INDEX_CACHE_KEY,
      JSON.stringify({ pools, timestamp: Date.now() })
    );
  } catch (error) {
    console.error("Failed to cache pool index:", error);
  }
};

/**
 * Gets cached pool summaries from localStorage if still valid
 */
const getCachedPoolSummaries = (): PoolSummary[] | null => {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(POOL_SUMMARIES_CACHE_KEY);
    if (!cached) return null;

    const { pools, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > POOL_SUMMARIES_CACHE_TTL;

    if (isExpired) {
      localStorage.removeItem(POOL_SUMMARIES_CACHE_KEY);
      return null;
    }

    return pools as PoolSummary[];
  } catch {
    return null;
  }
};

/**
 * Saves pool summaries to localStorage cache
 */
const setCachedPoolSummaries = (pools: PoolSummary[]): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      POOL_SUMMARIES_CACHE_KEY,
      JSON.stringify({ pools, timestamp: Date.now() })
    );
  } catch (error) {
    console.error("Failed to cache pool summaries:", error);
  }
};

/**
 * Fetches the pool index (IDs, states, member counts) - lightweight operation
 * This is cached and used for pagination calculations
 *
 * @param forceRefresh - If true, bypasses the cache
 * @returns Promise<PoolIndexEntry[]> - Array of pool index entries (only open pools)
 */
const fetchPoolIndex = async (
  forceRefresh = false
): Promise<PoolIndexEntry[]> => {
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedPoolIndex();
    if (cached) {
      console.log("Using cached pool index");
      return cached.filter((p) => p.state === "Open");
    }
  }

  const { typedApi } = getStakingClient();

  try {
    console.log("Fetching pool index from chain...");

    // Fetch all bonded pools - this gives us id, state, member_counter
    const bondedPoolsEntries = await typedApi.query.NominationPools.BondedPools.getEntries();

    // Build pool index (no metadata yet - that's expensive)
    const index: PoolIndexEntry[] = bondedPoolsEntries.map(
      (entry: { keyArgs: [number]; value: { state: { type: string }; member_counter: number } }) => ({
        id: entry.keyArgs[0],
        state: entry.value.state.type as "Open" | "Blocked" | "Destroying",
        memberCount: entry.value.member_counter,
      })
    );

    // Sort by member count (most popular first)
    const sortedIndex = index.sort((a, b) => b.memberCount - a.memberCount);

    // Cache all entries
    setCachedPoolIndex(sortedIndex);

    // Return only open pools
    return sortedIndex.filter((p) => p.state === "Open");
  } catch (error) {
    console.error("Failed to fetch pool index:", error);
    throw error;
  }
};

/**
 * Fetches pool metadata (names) for specific pool IDs
 *
 * @param poolIds - Array of pool IDs to fetch metadata for
 * @returns Promise<Map<number, string>> - Map of pool ID to name
 */
const fetchPoolMetadata = async (
  poolIds: number[]
): Promise<Map<number, string>> => {
  const { typedApi } = getStakingClient();

  const metadataPromises = poolIds.map((id) =>
    typedApi.query.NominationPools.Metadata.getValue(id)
  );
  const metadataResults = await Promise.all(metadataPromises);

  const metadataMap = new Map<number, string>();
  poolIds.forEach((id, index) => {
    const metadata = metadataResults[index];
    const name = metadata
      ? new TextDecoder().decode(metadata.asBytes())
      : `Pool #${id}`;
    metadataMap.set(id, name || `Pool #${id}`);
  });

  return metadataMap;
};

/**
 * Fetches paginated pool summaries
 * Only fetches metadata for the pools on the current page
 *
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of pools per page
 * @param forceRefresh - If true, bypasses the cache
 * @returns Promise<PaginatedPoolSummaries> - Paginated pool summaries
 */
export const fetchPoolSummariesPaginated = async (
  page: number,
  pageSize: number = 5,
  forceRefresh = false
): Promise<PaginatedPoolSummaries> => {
  // First, get the pool index (cached or fresh)
  const poolIndex = await fetchPoolIndex(forceRefresh);
  
  const totalPools = poolIndex.length;
  const totalPages = Math.ceil(totalPools / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  
  // Calculate slice indices
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalPools);
  
  // Get pool IDs for current page
  const pagePoolEntries = poolIndex.slice(startIndex, endIndex);
  const pagePoolIds = pagePoolEntries.map((p) => p.id);
  
  if (pagePoolIds.length === 0) {
    return {
      pools: [],
      currentPage,
      totalPages,
      totalPools,
      pageSize,
    };
  }
  
  // Fetch metadata only for current page's pools
  console.log(`Fetching metadata for page ${currentPage} pools:`, pagePoolIds);
  const metadataMap = await fetchPoolMetadata(pagePoolIds);
  
  // Build pool summaries for current page
  const pools: PoolSummary[] = pagePoolEntries.map((entry) => ({
    id: entry.id,
    name: metadataMap.get(entry.id) || `Pool #${entry.id}`,
    state: entry.state,
    memberCount: entry.memberCount,
  }));
  
  return {
    pools,
    currentPage,
    totalPages,
    totalPools,
    pageSize,
  };
};

/**
 * Fetches lightweight pool summaries for list display (LAZY LOADING)
 * Only fetches: id, name, state, memberCount
 * Much faster than fetching full pool details
 *
 * @param forceRefresh - If true, bypasses the cache
 * @returns Promise<PoolSummary[]> - Array of pool summaries
 * @deprecated Use fetchPoolSummariesPaginated for paginated fetching
 */
export const fetchPoolSummaries = async (
  forceRefresh = false
): Promise<PoolSummary[]> => {
  // Check localStorage cache first
  if (!forceRefresh) {
    const cached = getCachedPoolSummaries();
    if (cached) {
      console.log("Using cached pool summaries");
      return cached.filter((p) => p.state === "Open");
    }
  }

  const { typedApi } = getStakingClient();

  try {
    console.log("Fetching pool summaries from chain (lightweight)...");

    // Fetch all bonded pools - this gives us id, state, member_counter
    const bondedPoolsEntries = await typedApi.query.NominationPools.BondedPools.getEntries();

    // Fetch all pool metadata (names) in parallel
    const poolIds = bondedPoolsEntries.map((entry: { keyArgs: [number] }) => entry.keyArgs[0]);
    const metadataPromises = poolIds.map((id: number) =>
      typedApi.query.NominationPools.Metadata.getValue(id)
    );
    const metadataResults = await Promise.all(metadataPromises);

    // Build pool summaries
    const summaries: PoolSummary[] = bondedPoolsEntries.map(
      (entry: { keyArgs: [number]; value: { state: { type: string }; member_counter: number } }, index: number) => {
        const id = entry.keyArgs[0];
        const metadata = metadataResults[index];
        const name = metadata
          ? new TextDecoder().decode(metadata.asBytes())
          : `Pool #${id}`;

        return {
          id,
          name: name || `Pool #${id}`,
          state: entry.value.state.type as "Open" | "Blocked" | "Destroying",
          memberCount: entry.value.member_counter,
        };
      }
    );

    // Sort by member count
    const sortedSummaries = summaries.sort((a, b) => b.memberCount - a.memberCount);

    // Cache all summaries
    setCachedPoolSummaries(sortedSummaries);

    // Return only open pools
    return sortedSummaries.filter((p) => p.state === "Open");
  } catch (error) {
    console.error("Failed to fetch pool summaries:", error);
    throw error;
  }
};

/**
 * Fetches full details for a single pool (LAZY LOADING)
 * Called when user clicks on a pool to view details
 *
 * @param poolId - The pool ID to fetch details for
 * @returns Promise<PoolDetails | null> - Full pool details or null if not found
 */
export const fetchPoolDetails = async (
  poolId: number
): Promise<PoolDetails | null> => {
  const { stakingSdk } = getStakingClient();

  try {
    console.log(`Fetching details for pool #${poolId}...`);

    // Use SDK's observable for single pool (more efficient)
    return new Promise((resolve, reject) => {
      const pool$ = stakingSdk.getNominationPool$(poolId);
      const subscription = pool$.subscribe({
        next: (pool) => {
          subscription.unsubscribe();

          if (!pool) {
            resolve(null);
            return;
          }

          const details: PoolDetails = {
            id: pool.id,
            name: pool.name || `Pool #${pool.id}`,
            state: pool.state as "Open" | "Blocked" | "Destroying",
            memberCount: pool.memberCount,
            bond: pool.bond.toString(),
            commission: pool.commission?.current ?? 0,
            addresses: {
              stash: pool.addresses.pool,
              reward: pool.addresses.depositor,
              bouncer: pool.addresses.bouncer ?? "",
            },
          };

          resolve(details);
        },
        error: (err) => {
          subscription.unsubscribe();
          reject(err);
        },
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error("Timeout fetching pool details"));
      }, 15000);
    });
  } catch (error) {
    console.error(`Failed to fetch details for pool #${poolId}:`, error);
    throw error;
  }
};

/**
 * Fetches all available nomination pools
 * Filters to show only "Open" pools by default
 * Uses localStorage caching to reduce API calls (5 min TTL)
 * Uses persistent client to leverage SDK's per-era caching
 *
 * @param includeAll - If true, includes all pools regardless of state
 * @param forceRefresh - If true, bypasses the cache
 * @returns Promise<NominationPoolInfo[]> - Array of nomination pools
 */
export const fetchNominationPools = async (
  includeAll = false,
  forceRefresh = false
): Promise<NominationPoolInfo[]> => {
  // Check localStorage cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedPools = getCachedPools();
    if (cachedPools) {
      console.log("Using cached nomination pools");
      // Still filter based on includeAll
      const filtered = includeAll
        ? cachedPools
        : cachedPools.filter((p) => p.state === "Open");
      return filtered;
    }
  }

  // Use persistent client to take advantage of SDK caching
  const { stakingSdk } = getStakingClient();

  try {
    console.log("Fetching nomination pools from chain...");
    const pools = await stakingSdk.getNominationPools();

    // Map to our interface (keep all pools for caching)
    const mappedPools: NominationPoolInfo[] = pools.map((pool) => ({
      id: pool.id,
      name: pool.name || `Pool #${pool.id}`,
      state: pool.state as "Open" | "Blocked" | "Destroying",
      memberCount: pool.memberCount,
      bond: pool.bond.toString(),
      commission: pool.commission?.current ?? 0,
      addresses: {
        stash: pool.addresses.pool, // Pool account (stash equivalent)
        reward: pool.addresses.depositor, // Depositor as reward account
        bouncer: pool.addresses.bouncer ?? "",
      },
    }));

    // Sort by member count (most popular first)
    const sortedPools = mappedPools.sort((a, b) => b.memberCount - a.memberCount);

    // Cache the full list
    setCachedPools(sortedPools);

    // Filter for return
    const filtered = includeAll
      ? sortedPools
      : sortedPools.filter((p) => p.state === "Open");

    return filtered;
  } catch (error) {
    console.error("Failed to fetch nomination pools:", error);
    throw error;
  }
  // Note: Do NOT destroy client - we want to keep the cache
};

/**
 * Fetches the account staking status for the current user
 * Uses the observable from the SDK but converts to a promise for one-time fetch
 * Uses persistent client to leverage SDK's per-era caching
 *
 * @param address - Optional wallet address, uses localStorage if not provided
 * @returns Promise<StakingAccountStatus | null> - Account status or null if not found
 */
export const fetchAccountStakingStatus = async (
  address?: string
): Promise<StakingAccountStatus | null> => {
  const walletAddress = address || getWalletAddress();
  if (!walletAddress) {
    console.error("No wallet address available");
    return null;
  }

  // Use persistent client to take advantage of SDK caching
  const { stakingSdk } = getStakingClient();

  try {
    // Get account status as observable and convert to promise
    const status$ = stakingSdk.getAccountStatus$(walletAddress);

    return new Promise((resolve, reject) => {
      const subscription = status$.subscribe({
        next: (status) => {
          subscription.unsubscribe();

          const accountStatus: StakingAccountStatus = {
            balance: {
              total: status.balance.total.toString(),
              locked: status.balance.locked.toString(),
              spendable: status.balance.spendable.toString(),
              existentialDeposit: status.balance.raw.existentialDeposit.toString(),
            },
            nominationPool: {
              pool: status.nominationPool.pool,
              currentBond: status.nominationPool.currentBond.toString(),
              points: status.nominationPool.points.toString(),
              pendingRewards: status.nominationPool.pendingRewards.toString(),
              unlocks: status.nominationPool.unlocks.map((unlock) => ({
                value: unlock.value.toString(),
                era: unlock.era,
              })),
            },
          };

          resolve(accountStatus);
        },
        error: (err) => {
          subscription.unsubscribe();
          reject(err);
        },
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error("Timeout fetching account status"));
      }, 30000);
    });
  } catch (error) {
    console.error("Failed to fetch account staking status:", error);
    throw error;
  }
  // Note: Do NOT destroy client - we want to keep the cache
};

/**
 * Joins a nomination pool with the specified amount
 *
 * @param poolId - The ID of the pool to join
 * @param amount - Amount in DOT (human-readable, e.g., 10 for 10 DOT)
 * @returns Promise<StakingTransactionResult> - Transaction result
 */
export const joinNominationPool = async (
  poolId: number,
  amount: number
): Promise<StakingTransactionResult> => {
  // Ensure WASM crypto is ready
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

  const { client, typedApi } = createTransactionClient();

  try {
    // Convert amount to planck (smallest unit)
    const amountInPlanck = BigInt(Math.floor(amount * Math.pow(10, DOT_DECIMALS)));

    // Create join pool transaction
    const tx = typedApi.tx.NominationPools.join({
      amount: amountInPlanck,
      pool_id: poolId,
    });

    // Create signer
    const signer = getPolkadotSigner(
      keypair.publicKey,
      "Sr25519",
      (input) => keypair.sign(input)
    );

    // Sign and submit
    const result = await tx.signAndSubmit(signer);

    return {
      success: true,
      txHash: result.txHash,
      blockHash: result.block.hash,
    };
  } catch (error) {
    console.error("Failed to join nomination pool:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  } finally {
    client.destroy();
  }
};

/**
 * Adds more stake to the current pool (bond extra)
 *
 * @param amount - Amount in DOT to add
 * @returns Promise<StakingTransactionResult> - Transaction result
 */
export const bondExtra = async (
  amount: number
): Promise<StakingTransactionResult> => {
  await cryptoWaitReady();

  const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
  if (!mnemonic) {
    return {
      success: false,
      error: "Wallet seed not found. Please unlock your wallet first.",
    };
  }

  const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
  const keypair = keyring.addFromMnemonic(mnemonic);

  const { client, typedApi } = createTransactionClient();

  try {
    const amountInPlanck = BigInt(Math.floor(amount * Math.pow(10, DOT_DECIMALS)));

    const tx = typedApi.tx.NominationPools.bond_extra({
      extra: { type: "FreeBalance", value: amountInPlanck },
    });

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
    console.error("Failed to bond extra:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  } finally {
    client.destroy();
  }
};

/**
 * Unbonds from the current nomination pool
 * Uses the SDK helper which handles points conversion
 *
 * @param amount - Amount in DOT to unbond
 * @returns Promise<StakingTransactionResult> - Transaction result
 */
export const unbondFromPool = async (
  amount: number
): Promise<StakingTransactionResult> => {
  await cryptoWaitReady();

  const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
  if (!mnemonic) {
    return {
      success: false,
      error: "Wallet seed not found. Please unlock your wallet first.",
    };
  }

  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    return {
      success: false,
      error: "Wallet address not found.",
    };
  }

  const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
  const keypair = keyring.addFromMnemonic(mnemonic);

  const { client, stakingSdk } = createTransactionClient();

  try {
    const amountInPlanck = BigInt(Math.floor(amount * Math.pow(10, DOT_DECIMALS)));

    // Use SDK helper which handles points calculation
    const tx = await stakingSdk.unbondNominationPool(walletAddress, amountInPlanck);

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
    console.error("Failed to unbond from pool:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  } finally {
    client.destroy();
  }
};

/**
 * Claims pending rewards from the nomination pool
 *
 * @returns Promise<StakingTransactionResult> - Transaction result
 */
export const claimPoolRewards = async (): Promise<StakingTransactionResult> => {
  await cryptoWaitReady();

  const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
  if (!mnemonic) {
    return {
      success: false,
      error: "Wallet seed not found. Please unlock your wallet first.",
    };
  }

  const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
  const keypair = keyring.addFromMnemonic(mnemonic);

  const { client, typedApi } = createTransactionClient();

  try {
    const tx = typedApi.tx.NominationPools.claim_payout();

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
    console.error("Failed to claim rewards:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  } finally {
    client.destroy();
  }
};

/**
 * Withdraws unbonded funds from the nomination pool
 *
 * @returns Promise<StakingTransactionResult> - Transaction result
 */
export const withdrawUnbonded = async (): Promise<StakingTransactionResult> => {
  await cryptoWaitReady();

  const mnemonic = localStorage.getItem(WALLET_SEED_KEY);
  if (!mnemonic) {
    return {
      success: false,
      error: "Wallet seed not found. Please unlock your wallet first.",
    };
  }

  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    return {
      success: false,
      error: "Wallet address not found.",
    };
  }

  const keyring = new Keyring({ type: "sr25519", ss58Format: SS58_FORMAT });
  const keypair = keyring.addFromMnemonic(mnemonic);

  const { client, typedApi } = createTransactionClient();

  try {
    // Get the number of slashing spans (usually 0 for most users)
    const tx = typedApi.tx.NominationPools.withdraw_unbonded({
      member_account: { type: "Id", value: walletAddress },
      num_slashing_spans: 0,
    });

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
    console.error("Failed to withdraw unbonded:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  } finally {
    client.destroy();
  }
};

/**
 * Estimates the fee for joining a nomination pool
 * Uses persistent client (read-only operation)
 *
 * @param poolId - The pool ID to join
 * @param amount - Amount in DOT
 * @returns Promise<{ fee: string; feeFormatted: string }> - Fee estimate
 */
export const estimateJoinPoolFee = async (
  poolId: number,
  amount: number
): Promise<{ fee: string; feeFormatted: string }> => {
  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    throw new Error("Wallet address not found");
  }

  // Use persistent client (read-only operation)
  const { typedApi } = getStakingClient();

  const amountInPlanck = BigInt(Math.floor(amount * Math.pow(10, DOT_DECIMALS)));

  const tx = typedApi.tx.NominationPools.join({
    amount: amountInPlanck,
    pool_id: poolId,
  });

  const estimatedFee = await tx.getEstimatedFees(walletAddress);
  const feeInDot = Number(estimatedFee) / Math.pow(10, DOT_DECIMALS);

  let feeFormatted: string;
  if (feeInDot < 0.0001) {
    feeFormatted = feeInDot.toFixed(8);
  } else if (feeInDot < 0.01) {
    feeFormatted = feeInDot.toFixed(6);
  } else {
    feeFormatted = feeInDot.toFixed(4);
  }
  feeFormatted = feeFormatted.replace(/\.?0+$/, "");

  return {
    fee: estimatedFee.toString(),
    feeFormatted,
  };
};

/**
 * Formats a planck amount to DOT with proper decimals
 *
 * @param planck - Amount in planck (smallest unit)
 * @returns number - Amount in DOT
 */
export const planckToDot = (planck: string | bigint): number => {
  const value = typeof planck === "string" ? BigInt(planck) : planck;
  return Number(value) / Math.pow(10, DOT_DECIMALS);
};

/**
 * Formats DOT amount for display
 *
 * @param amount - Amount in DOT
 * @param maxDecimals - Maximum decimal places to show
 * @returns string - Formatted amount
 */
export const formatDotAmount = (amount: number, maxDecimals = 4): string => {
  if (amount === 0) return "0";
  if (amount < 0.0001) return "<0.0001";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
};
