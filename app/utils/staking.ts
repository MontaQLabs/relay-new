import { createClient, PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { createStakingSdk } from "@polkadot-api/sdk-staking";
import { pah } from "@polkadot-api/descriptors";
import { getPolkadotSigner } from "@polkadot-api/signer";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { WALLET_KEY, WALLET_SEED_KEY, SS58_FORMAT } from "../types/constants";
import type {
  NominationPoolInfo,
  StakingAccountStatus,
  StakingTransactionResult,
  Wallet,
} from "../types/frontend_type";

// Polkadot Asset Hub WebSocket endpoints (same as crypto.ts)
const ASSET_HUB_WS_ENDPOINTS = [
  "wss://polkadot-asset-hub-rpc.polkadot.io",
  "wss://statemint.api.onfinality.io/public-ws",
];

// DOT decimals on Polkadot
const DOT_DECIMALS = 10;

/**
 * Creates a Polkadot client and staking SDK
 * Returns both so they can be used together and cleaned up
 */
const createStakingClient = () => {
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
 * Fetches all available nomination pools
 * Filters to show only "Open" pools by default
 *
 * @param includeAll - If true, includes all pools regardless of state
 * @returns Promise<NominationPoolInfo[]> - Array of nomination pools
 */
export const fetchNominationPools = async (
  includeAll = false
): Promise<NominationPoolInfo[]> => {
  const { client, stakingSdk } = createStakingClient();

  try {
    const pools = await stakingSdk.getNominationPools();

    // Filter and map to our interface
    const mappedPools: NominationPoolInfo[] = pools
      .filter((pool) => includeAll || pool.state === "Open")
      .map((pool) => ({
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
    return mappedPools.sort((a, b) => b.memberCount - a.memberCount);
  } catch (error) {
    console.error("Failed to fetch nomination pools:", error);
    throw error;
  } finally {
    client.destroy();
  }
};

/**
 * Fetches the account staking status for the current user
 * Uses the observable from the SDK but converts to a promise for one-time fetch
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

  const { client, stakingSdk } = createStakingClient();

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
  } finally {
    client.destroy();
  }
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

  const { client, typedApi } = createStakingClient();

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

  const { client, typedApi } = createStakingClient();

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

  const { client, stakingSdk } = createStakingClient();

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

  const { client, typedApi } = createStakingClient();

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

  const { client, typedApi } = createStakingClient();

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

  const { client, typedApi } = createStakingClient();

  try {
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
  } finally {
    client.destroy();
  }
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
