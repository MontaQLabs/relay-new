/**
 * Supabase Database Operations
 * This file provides all database operations for the Relay app.
 *
 * Prerequisites:
 * - Set up Supabase project and run the SQL schema (see supabase-schema.sql)
 * - Configure environment variables (see SETUP.md)
 * - User must be authenticated before calling these functions
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  User,
  Friend,
  Transaction,
  Community,
  CommunityToken,
  Activity,
  Comment,
  ActivityStatus,
  KnownAsset,
  EcosystemProject,
  Challenge,
  ChallengeAgent,
  ChallengeVote,
  ChallengePayout,
  ChallengeStatus,
} from "../types/frontend_type";

// ============================================================================
// Supabase Client Setup
// ============================================================================

// Use placeholders during build when env vars are missing (e.g. CI, static export)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key-for-build";

// Storage key for auth token
const AUTH_TOKEN_STORAGE_KEY = "relay-auth-token";

// Client-side Supabase client (uses anon key, respects RLS)
// This base client is used for unauthenticated requests
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authenticated Supabase client that uses the custom JWT
let authenticatedClient: SupabaseClient | null = null;

// Get the current Supabase client (authenticated if available, otherwise base client)
export const getSupabaseClient = (): SupabaseClient => {
  return authenticatedClient || supabase;
};

// Create an authenticated Supabase client with custom JWT
const createAuthenticatedClient = (token: string): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

// Set auth token after wallet authentication
export const setSupabaseAuth = async (token: string): Promise<void> => {
  // Store token in localStorage for persistence
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  }

  // Create authenticated client with the custom JWT
  authenticatedClient = createAuthenticatedClient(token);
};

// Clear auth session
export const clearSupabaseAuth = async (): Promise<void> => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
  authenticatedClient = null;
};

// Restore auth session from stored token (call on app initialization)
export const restoreSupabaseAuth = (): boolean => {
  if (typeof window === "undefined") return false;

  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return false;

  // Check if token is expired
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000;
    if (Date.now() >= exp) {
      // Token expired, clear it
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      return false;
    }
  } catch {
    return false;
  }

  // Create authenticated client
  authenticatedClient = createAuthenticatedClient(token);
  return true;
};

// ============================================================================
// Database Types (matching Supabase schema)
// ============================================================================

interface DbFriend {
  id: string;
  user_wallet: string;
  nickname: string;
  wallet_address: string;
  network: string;
  remark: string | null;
  created_at: string;
}

interface DbCommunity {
  id: string;
  community_id: string;
  owner_wallet: string;
  name: string;
  description: string | null;
  avatar: string | null;
  rules: string | null;
  activity_types: string[];
  allow_investment: boolean;
  created_at: string;
}

interface DbActivity {
  id: string;
  activity_id: string;
  community_id: string;
  owner_wallet: string;
  title: string;
  description: string | null;
  is_paid: boolean;
  timestamp: string;
  type: string;
  max_attendees: number;
  pictures: string[];
  status: ActivityStatus;
  currency: string | null;
  amount: number | null;
  likes: number;
  created_at: string;
}

interface DbComment {
  id: string;
  comment_id: string;
  activity_id: string;
  publisher_wallet: string;
  content: string;
  timestamp: string;
  likes: number;
  created_at: string;
}

interface DbTransaction {
  id: string;
  tx_id: string;
  sender_wallet: string;
  sender_nickname: string | null;
  receiver_wallet: string;
  receiver_nickname: string | null;
  network: string;
  amount_fiat: number;
  fees_fiat: number;
  timestamp: string;
  created_at: string;
}

interface DbCommunityToken {
  id: string;
  community_id: string;
  asset_id: number;
  admin_wallet: string;
  min_balance: string;
  name: string;
  symbol: string;
  decimals: number;
  initial_supply: string;
  issuer_wallet: string | null;
  freezer_wallet: string | null;
  is_frozen: boolean;
  total_supply: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

interface DbKnownAsset {
  id: string;
  asset_id: number;
  ticker: string;
  decimals: number;
  symbol: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

interface DbEcosystemProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  chain_id: string;
  category: string;
  logo_url: string;
  website_url: string;
  twitter_url: string | null;
  defillama_slug: string | null;
  featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// User Operations
// ============================================================================

/**
 * Get the current authenticated user's profile
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const { data: session } = await getSupabaseClient().auth.getSession();
  if (!session?.session?.user) return null;

  const walletAddress = session.session.access_token
    ? JSON.parse(atob(session.session.access_token.split(".")[1])).wallet_address
    : null;

  if (!walletAddress) return null;

  return getUserByWallet(walletAddress);
};

/**
 * Get user profile by wallet address
 */
export const getUserByWallet = async (walletAddress: string): Promise<User | null> => {
  const { data: dbUser, error } = await getSupabaseClient()
    .from("users")
    .select("*")
    .eq("wallet_address", walletAddress)
    .single();

  if (error || !dbUser) return null;

  // Fetch related data
  const [friends, transactions, communities, activities] = await Promise.all([
    getFriends(walletAddress),
    getTransactions(walletAddress),
    getUserCommunities(walletAddress),
    getUserActivities(walletAddress),
  ]);

  // Get social recovery friends (marked in a separate query if needed)
  const socialRecovery = friends.slice(0, 3); // Placeholder - implement actual social recovery logic

  return {
    avatar: dbUser.avatar || "",
    nickname: dbUser.nickname || "",
    wallet: {
      address: walletAddress,
      network: "Polkadot Asset Hub",
      chainAccounts: [{ chainId: "polkadot", address: walletAddress }],
      status: "active",
      isBackedUp: true,
    },
    friends,
    socialRecovery,
    transactions,
    communities,
    activities: activities.map((a) => a.activityId),
  };
};

/**
 * Get user nickname by wallet address
 * Returns the nickname if found, otherwise returns a truncated wallet address
 */
export const getUserNickname = async (walletAddress: string): Promise<string> => {
  const { data, error } = await getSupabaseClient()
    .from("users")
    .select("nickname")
    .eq("wallet_address", walletAddress)
    .single();

  if (error || !data || !data.nickname) {
    // Return truncated wallet address as fallback
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }

  return data.nickname;
};

/**
 * Get user nicknames by wallet addresses (batch)
 * Returns a map of wallet address to nickname
 */
export const getUserNicknames = async (
  walletAddresses: string[]
): Promise<Record<string, string>> => {
  if (walletAddresses.length === 0) return {};

  // Remove duplicates
  const uniqueAddresses = [...new Set(walletAddresses)];

  const { data, error } = await getSupabaseClient()
    .from("users")
    .select("wallet_address, nickname")
    .in("wallet_address", uniqueAddresses);

  const nicknameMap: Record<string, string> = {};

  // Initialize all addresses with truncated fallback
  uniqueAddresses.forEach((address) => {
    nicknameMap[address] = `${address.slice(0, 6)}...${address.slice(-4)}`;
  });

  // Override with actual nicknames where available
  if (!error && data) {
    data.forEach((user: { wallet_address: string; nickname: string | null }) => {
      if (user.nickname) {
        nicknameMap[user.wallet_address] = user.nickname;
      }
    });
  }

  return nicknameMap;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  walletAddress: string,
  updates: { avatar?: string; nickname?: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("users")
    .update({
      avatar: updates.avatar,
      nickname: updates.nickname,
    })
    .eq("wallet_address", walletAddress);

  return !error;
};

/**
 * Create or update user (upsert)
 */
export const upsertUser = async (
  walletAddress: string,
  data?: { avatar?: string; nickname?: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient().from("users").upsert(
    {
      wallet_address: walletAddress,
      avatar: data?.avatar,
      nickname: data?.nickname,
      last_login: new Date().toISOString(),
    },
    {
      onConflict: "wallet_address",
    }
  );

  return !error;
};

// ============================================================================
// Friends Operations
// ============================================================================

/**
 * Get all friends for a user
 */
export const getFriends = async (walletAddress: string): Promise<Friend[]> => {
  const { data, error } = await getSupabaseClient()
    .from("friends")
    .select("*")
    .eq("user_wallet", walletAddress)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((f: DbFriend) => ({
    nickname: f.nickname,
    walletAddress: f.wallet_address,
    network: f.network,
    remark: f.remark || "",
  }));
};

/**
 * Add a new friend
 */
export const addFriend = async (userWallet: string, friend: Friend): Promise<boolean> => {
  const { error } = await getSupabaseClient().from("friends").insert({
    user_wallet: userWallet,
    nickname: friend.nickname,
    wallet_address: friend.walletAddress,
    network: friend.network,
    remark: friend.remark,
  });

  return !error;
};

/**
 * Update a friend's information
 */
export const updateFriend = async (
  userWallet: string,
  friendWalletAddress: string,
  updates: Partial<Friend>
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("friends")
    .update({
      nickname: updates.nickname,
      network: updates.network,
      remark: updates.remark,
    })
    .eq("user_wallet", userWallet)
    .eq("wallet_address", friendWalletAddress);

  return !error;
};

/**
 * Remove a friend (client-side)
 */
export const removeFriend = async (
  userWallet: string,
  friendWalletAddress: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("friends")
    .delete()
    .eq("user_wallet", userWallet)
    .eq("wallet_address", friendWalletAddress);

  return !error;
};

/**
 * Delete a friend (server-side compatible)
 * Accepts an optional Supabase client for server-side use
 * Uses case-insensitive comparison for wallet addresses
 */
export const deleteFriend = async (
  userWallet: string,
  friendWalletAddress: string,
  client?: SupabaseClient
): Promise<{ success: boolean; error?: string }> => {
  const supabaseClient = client || getSupabaseClient();

  // Trim wallet addresses
  const trimmedUserWallet = userWallet.trim();
  const trimmedFriendWallet = friendWalletAddress.trim();

  // First, get all friends for this user to find the exact match (case-insensitive)
  const { data: allFriends, error: fetchError } = await supabaseClient
    .from("friends")
    .select("id, user_wallet, wallet_address")
    .eq("user_wallet", trimmedUserWallet);

  if (fetchError) {
    console.error("Error fetching friends:", fetchError);
    return { success: false, error: "Failed to check friend existence" };
  }

  // Find the friend with case-insensitive wallet address comparison
  const friend = allFriends?.find(
    (f) => f.wallet_address.toLowerCase().trim() === trimmedFriendWallet.toLowerCase()
  );

  if (!friend) {
    return { success: false, error: "Friend not found" };
  }

  // Delete using the exact stored values (preserving case)
  const { error: deleteError } = await supabaseClient.from("friends").delete().eq("id", friend.id);

  if (deleteError) {
    console.error("Error deleting friend:", deleteError);
    return { success: false, error: "Failed to delete friend" };
  }

  return { success: true };
};

// ============================================================================
// Community Operations
// ============================================================================

/**
 * Search communities by name (partial match, case-insensitive)
 */
export const searchCommunities = async (searchTerm: string): Promise<Community[]> => {
  if (!searchTerm.trim()) return [];

  const { data, error } = await getSupabaseClient()
    .from("communities")
    .select("*")
    .ilike("name", `%${searchTerm.trim()}%`)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const communitiesWithDetails = await Promise.all(
    data.map(async (c: DbCommunity) => {
      const activities = await getCommunityActivities(c.community_id);
      const memberCount = await getCommunityMemberCount(c.community_id);
      return {
        owner: c.owner_wallet,
        name: c.name,
        description: c.description || "",
        avatar: c.avatar || "",
        communityId: c.community_id,
        rules: c.rules || undefined,
        activityTypes: c.activity_types || [],
        allowInvestment: c.allow_investment ?? true,
        activities: activities.map((a) => a.activityId),
        memberCount,
      };
    })
  );

  return communitiesWithDetails;
};

/**
 * Get all communities (public)
 */
export const getAllCommunities = async (): Promise<Community[]> => {
  const { data, error } = await getSupabaseClient()
    .from("communities")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Get activities for each community
  const communitiesWithActivities = await Promise.all(
    data.map(async (c: DbCommunity) => {
      const activities = await getCommunityActivities(c.community_id);
      return {
        owner: c.owner_wallet,
        name: c.name,
        description: c.description || "",
        avatar: c.avatar || "",
        communityId: c.community_id,
        rules: c.rules || undefined,
        activityTypes: c.activity_types || [],
        allowInvestment: c.allow_investment ?? true,
        activities: activities.map((a) => a.activityId),
      };
    })
  );

  return communitiesWithActivities;
};

/**
 * Get communities that a user has created (is owner of)
 */
export const getCreatedCommunities = async (walletAddress: string): Promise<Community[]> => {
  const { data, error } = await getSupabaseClient()
    .from("communities")
    .select("*")
    .eq("owner_wallet", walletAddress)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const communitiesWithActivities = await Promise.all(
    data.map(async (c: DbCommunity) => {
      const activities = await getCommunityActivities(c.community_id);
      const memberCount = await getCommunityMemberCount(c.community_id);
      return {
        owner: c.owner_wallet,
        name: c.name,
        description: c.description || "",
        avatar: c.avatar || "",
        communityId: c.community_id,
        rules: c.rules || undefined,
        activityTypes: c.activity_types || [],
        allowInvestment: c.allow_investment ?? true,
        activities: activities.map((a) => a.activityId),
        memberCount,
      };
    })
  );

  return communitiesWithActivities;
};

/**
 * Get communities that a user is a member of (excluding ones they own)
 */
export const getUserCommunities = async (walletAddress: string): Promise<Community[]> => {
  const { data, error } = await getSupabaseClient()
    .from("community_members")
    .select(
      `
      community_id,
      communities (*)
    `
    )
    .eq("user_wallet", walletAddress);

  if (error || !data) return [];

  const communitiesWithActivities = await Promise.all(
    data
      .filter((item) => {
        const c = item.communities as unknown as DbCommunity;
        // Exclude communities where the user is the owner (those go in "Created" tab)
        return c.owner_wallet !== walletAddress;
      })
      .map(async (item) => {
        const c = item.communities as unknown as DbCommunity;
        const activities = await getCommunityActivities(c.community_id);
        const memberCount = await getCommunityMemberCount(c.community_id);
        return {
          owner: c.owner_wallet,
          name: c.name,
          description: c.description || "",
          avatar: c.avatar || "",
          communityId: c.community_id,
          rules: c.rules || undefined,
          activityTypes: c.activity_types || [],
          allowInvestment: c.allow_investment ?? true,
          activities: activities.map((a) => a.activityId),
          memberCount,
        };
      })
  );

  return communitiesWithActivities;
};

/**
 * Get a single community by ID
 */
export const getCommunity = async (communityId: string): Promise<Community | null> => {
  const { data, error } = await getSupabaseClient()
    .from("communities")
    .select("*")
    .eq("community_id", communityId)
    .single();

  if (error || !data) return null;

  const activities = await getCommunityActivities(communityId);
  const token = await getCommunityToken(communityId);

  return {
    owner: data.owner_wallet,
    name: data.name,
    description: data.description || "",
    avatar: data.avatar || "",
    communityId: data.community_id,
    rules: data.rules || undefined,
    activityTypes: data.activity_types || [],
    allowInvestment: data.allow_investment ?? true,
    activities: activities.map((a) => a.activityId),
    token: token || undefined,
  };
};

/**
 * Create a new community
 */
export const createCommunity = async (
  ownerWallet: string,
  community: Omit<Community, "owner" | "activities">
): Promise<string | null> => {
  const communityId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { error } = await getSupabaseClient()
    .from("communities")
    .insert({
      community_id: communityId,
      owner_wallet: ownerWallet,
      name: community.name,
      description: community.description,
      avatar: community.avatar,
      rules: community.rules || null,
      activity_types: community.activityTypes,
      allow_investment: community.allowInvestment,
    });

  if (error) return null;

  // Add owner as a member
  await joinCommunity(communityId, ownerWallet);

  return communityId;
};

/**
 * Update a community (owner only - enforced by RLS)
 */
export const updateCommunity = async (
  communityId: string,
  updates: {
    name?: string;
    description?: string;
    avatar?: string;
    rules?: string;
    activityTypes?: string[];
    allowInvestment?: boolean;
  }
): Promise<boolean> => {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
  if (updates.rules !== undefined) dbUpdates.rules = updates.rules;
  if (updates.activityTypes !== undefined) dbUpdates.activity_types = updates.activityTypes;
  if (updates.allowInvestment !== undefined) dbUpdates.allow_investment = updates.allowInvestment;

  const { error } = await getSupabaseClient()
    .from("communities")
    .update(dbUpdates)
    .eq("community_id", communityId);

  return !error;
};

/**
 * Delete a community (owner only - enforced by RLS)
 */
export const deleteCommunity = async (communityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("communities")
    .delete()
    .eq("community_id", communityId);

  return !error;
};

/**
 * Join a community
 */
export const joinCommunity = async (communityId: string, userWallet: string): Promise<boolean> => {
  const { error } = await getSupabaseClient().from("community_members").insert({
    community_id: communityId,
    user_wallet: userWallet,
  });

  return !error;
};

/**
 * Leave a community
 */
export const leaveCommunity = async (communityId: string, userWallet: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_wallet", userWallet);

  return !error;
};

/**
 * Get community members
 */
export const getCommunityMembers = async (communityId: string): Promise<string[]> => {
  const { data, error } = await getSupabaseClient()
    .from("community_members")
    .select("user_wallet")
    .eq("community_id", communityId);

  if (error || !data) return [];

  return data.map((m: { user_wallet: string }) => m.user_wallet);
};

/**
 * Get community member count
 */
export const getCommunityMemberCount = async (communityId: string): Promise<number> => {
  const { count, error } = await getSupabaseClient()
    .from("community_members")
    .select("*", { count: "exact", head: true })
    .eq("community_id", communityId);

  if (error || count === null) return 0;

  return count;
};

/**
 * Check if a user is a member of a community
 */
export const isUserCommunityMember = async (
  communityId: string,
  userWallet: string
): Promise<boolean> => {
  const { data, error } = await getSupabaseClient()
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_wallet", userWallet)
    .single();

  return !error && !!data;
};

/**
 * Check membership for multiple communities at once
 */
export const checkUserMembershipBulk = async (
  communityIds: string[],
  userWallet: string
): Promise<Record<string, boolean>> => {
  if (communityIds.length === 0) return {};

  const { data, error } = await getSupabaseClient()
    .from("community_members")
    .select("community_id")
    .eq("user_wallet", userWallet)
    .in("community_id", communityIds);

  if (error || !data) return {};

  const membershipMap: Record<string, boolean> = {};
  communityIds.forEach((id) => {
    membershipMap[id] = data.some((m) => m.community_id === id);
  });

  return membershipMap;
};

// ============================================================================
// Community Token Operations (Polkadot Asset Hub)
// ============================================================================

/**
 * Map database community token to frontend type
 */
const mapDbCommunityTokenToToken = (db: DbCommunityToken): CommunityToken => ({
  assetId: db.asset_id,
  admin: db.admin_wallet,
  minBalance: db.min_balance,
  name: db.name,
  symbol: db.symbol,
  decimals: db.decimals,
  initialSupply: db.initial_supply,
  issuer: db.issuer_wallet || undefined,
  freezer: db.freezer_wallet || undefined,
  isFrozen: db.is_frozen,
  totalSupply: db.total_supply,
  icon: db.icon || undefined,
  createdAt: db.created_at,
});

/**
 * Get community token by community ID
 */
export const getCommunityToken = async (communityId: string): Promise<CommunityToken | null> => {
  const { data, error } = await getSupabaseClient()
    .from("community_tokens")
    .select("*")
    .eq("community_id", communityId)
    .single();

  if (error || !data) return null;

  return mapDbCommunityTokenToToken(data);
};

/**
 * Create a community token (owner only - enforced by RLS)
 */
export const createCommunityToken = async (
  communityId: string,
  token: Omit<CommunityToken, "createdAt" | "isFrozen" | "totalSupply"> & { totalSupply?: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("community_tokens")
    .insert({
      community_id: communityId,
      asset_id: token.assetId,
      admin_wallet: token.admin,
      min_balance: token.minBalance,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      initial_supply: token.initialSupply,
      issuer_wallet: token.issuer || null,
      freezer_wallet: token.freezer || null,
      is_frozen: false,
      total_supply: token.totalSupply || token.initialSupply,
      icon: token.icon || null,
    });

  return !error;
};

/**
 * Update a community token (owner only - enforced by RLS)
 */
export const updateCommunityToken = async (
  communityId: string,
  updates: Partial<{
    name: string;
    symbol: string;
    decimals: number;
    minBalance: string;
    issuer: string;
    freezer: string;
    icon: string;
  }>
): Promise<boolean> => {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.symbol !== undefined) dbUpdates.symbol = updates.symbol;
  if (updates.decimals !== undefined) dbUpdates.decimals = updates.decimals;
  if (updates.minBalance !== undefined) dbUpdates.min_balance = updates.minBalance;
  if (updates.issuer !== undefined) dbUpdates.issuer_wallet = updates.issuer;
  if (updates.freezer !== undefined) dbUpdates.freezer_wallet = updates.freezer;
  if (updates.icon !== undefined) dbUpdates.icon = updates.icon;

  const { error } = await getSupabaseClient()
    .from("community_tokens")
    .update(dbUpdates)
    .eq("community_id", communityId);

  return !error;
};

/**
 * Delete a community token (owner only - enforced by RLS)
 */
export const deleteCommunityToken = async (communityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("community_tokens")
    .delete()
    .eq("community_id", communityId);

  return !error;
};

/**
 * Update token total supply (called after minting on-chain)
 */
export const updateTokenSupply = async (
  communityId: string,
  newSupply: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("community_tokens")
    .update({ total_supply: newSupply })
    .eq("community_id", communityId);

  return !error;
};

/**
 * Set token frozen status
 */
export const setTokenFrozen = async (communityId: string, isFrozen: boolean): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("community_tokens")
    .update({ is_frozen: isFrozen })
    .eq("community_id", communityId);

  return !error;
};

/**
 * Check if an asset ID is already in use
 */
export const isAssetIdAvailable = async (assetId: number): Promise<boolean> => {
  const { data, error } = await getSupabaseClient()
    .from("community_tokens")
    .select("id")
    .eq("asset_id", assetId)
    .single();

  // If error or no data, the asset ID is available
  return !!error || !data;
};

// ============================================================================
// Known Assets Operations (Polkadot Asset Hub)
// ============================================================================

/**
 * Map database known asset to frontend type
 */
const mapDbKnownAssetToKnownAsset = (db: DbKnownAsset): KnownAsset => ({
  id: db.asset_id,
  ticker: db.ticker,
  decimals: db.decimals,
  symbol: db.symbol,
  category: db.category || undefined,
});

/**
 * Get all known assets from the database
 * These are popular tokens on Polkadot Asset Hub that users can browse
 */
export const getKnownAssets = async (): Promise<KnownAsset[]> => {
  const { data, error } = await getSupabaseClient()
    .from("known_assets")
    .select("*")
    .order("asset_id", { ascending: true });

  if (error || !data) return [];

  return data.map(mapDbKnownAssetToKnownAsset);
};

/**
 * Get a known asset by its asset ID
 */
export const getKnownAssetById = async (assetId: number): Promise<KnownAsset | null> => {
  const { data, error } = await getSupabaseClient()
    .from("known_assets")
    .select("*")
    .eq("asset_id", assetId)
    .single();

  if (error || !data) return null;

  return mapDbKnownAssetToKnownAsset(data);
};

/**
 * Get known assets by category
 */
export const getKnownAssetsByCategory = async (category: string): Promise<KnownAsset[]> => {
  const { data, error } = await getSupabaseClient()
    .from("known_assets")
    .select("*")
    .eq("category", category)
    .order("asset_id", { ascending: true });

  if (error || !data) return [];

  return data.map(mapDbKnownAssetToKnownAsset);
};

// ============================================================================
// Ecosystem Projects Operations (Multi-chain Explore)
// ============================================================================

/**
 * Map database ecosystem project to frontend type
 */
const mapDbEcosystemProject = (db: DbEcosystemProject): EcosystemProject => ({
  id: db.id,
  name: db.name,
  slug: db.slug,
  description: db.description,
  chainId: db.chain_id as EcosystemProject["chainId"],
  category: db.category,
  logoUrl: db.logo_url,
  websiteUrl: db.website_url,
  twitterUrl: db.twitter_url || undefined,
  defillamaSlug: db.defillama_slug || undefined,
  featured: db.featured,
});

/**
 * Get all ecosystem projects ordered by display_order
 */
export const getEcosystemProjects = async (): Promise<EcosystemProject[]> => {
  const { data, error } = await getSupabaseClient()
    .from("ecosystem_projects")
    .select("*")
    .order("display_order", { ascending: true });

  if (error || !data) return [];

  return data.map(mapDbEcosystemProject);
};

/**
 * Get ecosystem projects filtered by chain
 */
export const getEcosystemProjectsByChain = async (chainId: string): Promise<EcosystemProject[]> => {
  const { data, error } = await getSupabaseClient()
    .from("ecosystem_projects")
    .select("*")
    .eq("chain_id", chainId)
    .order("display_order", { ascending: true });

  if (error || !data) return [];

  return data.map(mapDbEcosystemProject);
};

/**
 * Get only featured ecosystem projects
 */
export const getFeaturedProjects = async (): Promise<EcosystemProject[]> => {
  const { data, error } = await getSupabaseClient()
    .from("ecosystem_projects")
    .select("*")
    .eq("featured", true)
    .order("display_order", { ascending: true });

  if (error || !data) return [];

  return data.map(mapDbEcosystemProject);
};

// ============================================================================
// Activity Operations
// ============================================================================

/**
 * Get all activities in a community
 */
export const getCommunityActivities = async (communityId: string): Promise<Activity[]> => {
  const { data, error } = await getSupabaseClient()
    .from("activities")
    .select("*")
    .eq("community_id", communityId)
    .order("timestamp", { ascending: false });

  if (error || !data) return [];

  return Promise.all(data.map(mapDbActivityToActivity));
};

/**
 * Get activities that a user is attending or owns
 */
export const getUserActivities = async (walletAddress: string): Promise<Activity[]> => {
  // Get activities the user owns
  const { data: ownedData } = await getSupabaseClient()
    .from("activities")
    .select("*")
    .eq("owner_wallet", walletAddress);

  // Get activities the user is attending
  const { data: attendingData } = await getSupabaseClient()
    .from("activity_attendees")
    .select(
      `
      activity_id,
      activities (*)
    `
    )
    .eq("user_wallet", walletAddress);

  const activities: DbActivity[] = [];

  if (ownedData) {
    activities.push(...ownedData);
  }

  if (attendingData) {
    attendingData.forEach((item) => {
      const activity = item.activities as unknown as DbActivity;
      if (activity && !activities.find((a) => a.activity_id === activity.activity_id)) {
        activities.push(activity);
      }
    });
  }

  return Promise.all(activities.map(mapDbActivityToActivity));
};

/**
 * Get a single activity by ID
 */
export const getActivity = async (activityId: string): Promise<Activity | null> => {
  const { data, error } = await getSupabaseClient()
    .from("activities")
    .select("*")
    .eq("activity_id", activityId)
    .single();

  if (error || !data) return null;

  return mapDbActivityToActivity(data);
};

/**
 * Create a new activity
 */
export const createActivity = async (
  ownerWallet: string,
  activity: Omit<Activity, "activityId" | "owner" | "attendees" | "comments" | "likes">
): Promise<string | null> => {
  const activityId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { error } = await getSupabaseClient().from("activities").insert({
    activity_id: activityId,
    community_id: activity.communityId,
    owner_wallet: ownerWallet,
    title: activity.title,
    description: activity.description,
    is_paid: activity.isPaid,
    timestamp: activity.timestamp,
    type: activity.type,
    max_attendees: activity.maxAttendees,
    pictures: activity.pictures,
    status: activity.status,
    currency: activity.currency,
    amount: activity.amount,
    likes: 0,
  });

  if (error) {
    console.error("Failed to create activity:", error.message, error.details, error.hint);
    return null;
  }

  // Add owner as an attendee
  await joinActivity(activityId, ownerWallet);

  return activityId;
};

/**
 * Update an activity (owner only - enforced by RLS)
 */
export const updateActivity = async (
  activityId: string,
  updates: Partial<
    Omit<Activity, "activityId" | "communityId" | "owner" | "attendees" | "comments">
  >
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("activities")
    .update({
      title: updates.title,
      description: updates.description,
      is_paid: updates.isPaid,
      timestamp: updates.timestamp,
      type: updates.type,
      max_attendees: updates.maxAttendees,
      pictures: updates.pictures,
      status: updates.status,
      currency: updates.currency,
      amount: updates.amount,
    })
    .eq("activity_id", activityId);

  return !error;
};

/**
 * Delete an activity (owner only - enforced by RLS)
 */
export const deleteActivity = async (activityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("activities")
    .delete()
    .eq("activity_id", activityId);

  return !error;
};

/**
 * Join an activity
 */
export const joinActivity = async (activityId: string, userWallet: string): Promise<boolean> => {
  const { error } = await getSupabaseClient().from("activity_attendees").insert({
    activity_id: activityId,
    user_wallet: userWallet,
  });

  return !error;
};

/**
 * Leave an activity
 */
export const leaveActivity = async (activityId: string, userWallet: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("activity_attendees")
    .delete()
    .eq("activity_id", activityId)
    .eq("user_wallet", userWallet);

  return !error;
};

/**
 * Like an activity
 */
export const likeActivity = async (activityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient().rpc("increment_activity_likes", {
    p_activity_id: activityId,
  });

  return !error;
};

/**
 * Get activity attendees
 */
export const getActivityAttendees = async (activityId: string): Promise<string[]> => {
  const { data, error } = await getSupabaseClient()
    .from("activity_attendees")
    .select("user_wallet")
    .eq("activity_id", activityId);

  if (error || !data) return [];

  return data.map((a: { user_wallet: string }) => a.user_wallet);
};

// Helper function to map DB activity to frontend Activity type
const mapDbActivityToActivity = async (dbActivity: DbActivity): Promise<Activity> => {
  const [attendees, comments] = await Promise.all([
    getActivityAttendees(dbActivity.activity_id),
    getActivityComments(dbActivity.activity_id),
  ]);

  return {
    communityId: dbActivity.community_id,
    activityId: dbActivity.activity_id,
    owner: dbActivity.owner_wallet,
    title: dbActivity.title,
    description: dbActivity.description || "",
    isPaid: dbActivity.is_paid,
    timestamp: dbActivity.timestamp,
    type: dbActivity.type,
    maxAttendees: dbActivity.max_attendees,
    pictures: dbActivity.pictures || [],
    attendees,
    comments: comments.map((c) => c.commentId),
    likes: dbActivity.likes,
    status: dbActivity.status,
    currency: dbActivity.currency || undefined,
    amount: dbActivity.amount || undefined,
  };
};

// ============================================================================
// Comment Operations
// ============================================================================

/**
 * Get all comments for an activity
 */
export const getActivityComments = async (activityId: string): Promise<Comment[]> => {
  const { data, error } = await getSupabaseClient()
    .from("comments")
    .select("*")
    .eq("activity_id", activityId)
    .order("timestamp", { ascending: true });

  if (error || !data) return [];

  return data.map((c: DbComment) => ({
    commentId: c.comment_id,
    publisher: c.publisher_wallet,
    content: c.content,
    timestamp: c.timestamp,
    likes: c.likes,
  }));
};

/**
 * Get a single comment by ID
 */
export const getComment = async (commentId: string): Promise<Comment | null> => {
  const { data, error } = await getSupabaseClient()
    .from("comments")
    .select("*")
    .eq("comment_id", commentId)
    .single();

  if (error || !data) return null;

  return {
    commentId: data.comment_id,
    publisher: data.publisher_wallet,
    content: data.content,
    timestamp: data.timestamp,
    likes: data.likes,
  };
};

/**
 * Create a new comment
 */
export const createComment = async (
  publisherWallet: string,
  activityId: string,
  content: string
): Promise<string | null> => {
  const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { error } = await getSupabaseClient().from("comments").insert({
    comment_id: commentId,
    activity_id: activityId,
    publisher_wallet: publisherWallet,
    content,
    timestamp: new Date().toISOString(),
    likes: 0,
  });

  if (error) return null;

  return commentId;
};

/**
 * Update a comment (publisher only - enforced by RLS)
 */
export const updateComment = async (commentId: string, content: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from("comments")
    .update({ content })
    .eq("comment_id", commentId);

  return !error;
};

/**
 * Delete a comment (publisher only - enforced by RLS)
 */
export const deleteComment = async (commentId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient().from("comments").delete().eq("comment_id", commentId);

  return !error;
};

/**
 * Like a comment
 */
export const likeComment = async (commentId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient().rpc("increment_comment_likes", {
    p_comment_id: commentId,
  });

  return !error;
};

// ============================================================================
// Transaction Operations (Read-only - transactions are recorded by the blockchain)
// ============================================================================

/**
 * Get all transactions for a user (as sender or receiver)
 */
export const getTransactions = async (walletAddress: string): Promise<Transaction[]> => {
  const { data, error } = await getSupabaseClient()
    .from("transactions")
    .select("*")
    .or(`sender_wallet.eq.${walletAddress},receiver_wallet.eq.${walletAddress}`)
    .order("timestamp", { ascending: false });

  if (error || !data) return [];

  return data.map((t: DbTransaction) => {
    // Determine transaction type based on wallet address
    const isSent = t.sender_wallet.toLowerCase() === walletAddress.toLowerCase();
    const type: "sent" | "received" = isSent ? "sent" : "received";

    // Derive ticker from network (default to DOT for Polkadot networks)
    const ticker =
      t.network.includes("Polkadot") || t.network.includes("Asset Hub") ? "DOT" : "UNKNOWN";

    return {
      id: t.tx_id,
      sender: t.sender_nickname || "Unknown",
      senderAddress: t.sender_wallet,
      receiver: t.receiver_nickname || "Unknown",
      receiverAddress: t.receiver_wallet,
      network: t.network,
      ticker: ticker,
      amount: 0, // Amount in native coin not stored in DB, default to 0
      amountFiat: t.amount_fiat,
      fee: 0, // Fee in native coin not stored in DB, default to 0
      feesFiat: t.fees_fiat,
      timestamp: t.timestamp,
      status: "completed" as const, // Transactions in DB are already completed
      type: type,
    };
  });
};

/**
 * Record a new transaction (called after blockchain confirmation)
 */
export const recordTransaction = async (
  transaction: Omit<Transaction, "id"> & { txHash: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient().from("transactions").insert({
    tx_id: transaction.txHash,
    sender_wallet: transaction.senderAddress,
    sender_nickname: transaction.sender,
    receiver_wallet: transaction.receiverAddress,
    receiver_nickname: transaction.receiver,
    network: transaction.network,
    amount_fiat: transaction.amountFiat,
    fees_fiat: transaction.feesFiat,
    timestamp: transaction.timestamp,
  });

  return !error;
};

// ============================================================================
// Championship Operations
// ============================================================================

interface DbChallenge {
  id: string;
  challenge_id: string;
  creator_wallet: string;
  title: string;
  description: string;
  abstract_description: string | null;
  full_challenge_encrypted: string | null;
  challenge_hash: string | null;
  categories: string[] | null;
  chain_id: string;
  rules: string | null;
  start_time: string;
  end_time: string;
  judge_end: string;
  competition_duration_seconds: number | null;
  refund_window_seconds: number | null;
  status: ChallengeStatus;
  escrow_address: string | null;
  entry_fee_dot: string;
  total_entry_pool_dot: string;
  total_bet_pool_dot: string;
  winner_agent_id: string | null;
  created_at: string;
}

interface DbChallengeAgent {
  id: string;
  challenge_id: string;
  owner_wallet: string;
  agent_name: string;
  repo_url: string;
  commit_hash: string;
  endpoint_url: string;
  description: string | null;
  entry_tx_hash: string;
  entry_verified: boolean;
  total_votes: number;
  enrolled_at: string;
}

interface DbChallengeVote {
  id: string;
  challenge_id: string;
  voter_wallet: string;
  agent_id: string;
  voted_at: string;
}

interface DbChallengePayout {
  id: string;
  challenge_id: string;
  recipient_wallet: string;
  amount_dot: string;
  payout_type: string;
  tx_hash: string | null;
  status: string;
  created_at: string;
}

// Helper to map DB challenge to frontend type
const mapDbChallengeToChallenge = (c: DbChallenge): Challenge => ({
  challengeId: c.challenge_id,
  creator: c.creator_wallet,
  title: c.title,
  description: c.description,
  abstractDescription: c.abstract_description || undefined,
  challengeHash: c.challenge_hash || undefined,
  categories: c.categories || undefined,
  chainId: c.chain_id,
  rules: c.rules || undefined,
  startTime: c.start_time,
  endTime: c.end_time,
  judgeEnd: c.judge_end,
  competitionDurationSeconds: c.competition_duration_seconds || undefined,
  refundWindowSeconds: c.refund_window_seconds || undefined,
  status: c.status,
  escrowAddress: c.escrow_address || "",
  entryFeeDot: c.entry_fee_dot,
  totalEntryPoolDot: c.total_entry_pool_dot,
  totalBetPoolDot: c.total_bet_pool_dot,
  winnerAgentId: c.winner_agent_id || undefined,
});

// Helper to map DB agent to frontend type
const mapDbAgentToAgent = (a: DbChallengeAgent): ChallengeAgent => ({
  id: a.id,
  challengeId: a.challenge_id,
  owner: a.owner_wallet,
  agentName: a.agent_name,
  repoUrl: a.repo_url,
  commitHash: a.commit_hash,
  endpointUrl: a.endpoint_url,
  description: a.description || "",
  entryTxHash: a.entry_tx_hash,
  entryVerified: a.entry_verified,
  totalVotes: a.total_votes,
  enrolledAt: a.enrolled_at,
});

/**
 * Get all challenges, optionally filtered by status
 */
export const getAllChallenges = async (status?: ChallengeStatus): Promise<Challenge[]> => {
  let query = getSupabaseClient()
    .from("challenges")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Get agent counts for each challenge
  const challenges = data.map(mapDbChallengeToChallenge);
  const challengeIds = challenges.map((c) => c.challengeId);

  if (challengeIds.length > 0) {
    const { data: agentCounts } = await getSupabaseClient()
      .from("challenge_agents")
      .select("challenge_id")
      .in("challenge_id", challengeIds);

    if (agentCounts) {
      const countMap: Record<string, number> = {};
      agentCounts.forEach((a: { challenge_id: string }) => {
        countMap[a.challenge_id] = (countMap[a.challenge_id] || 0) + 1;
      });
      challenges.forEach((c) => {
        c.agentCount = countMap[c.challengeId] || 0;
      });
    }
  }

  return challenges;
};

/**
 * Get a single challenge by ID
 */
export const getChallenge = async (challengeId: string): Promise<Challenge | null> => {
  const { data, error } = await getSupabaseClient()
    .from("challenges")
    .select("*")
    .eq("challenge_id", challengeId)
    .single();

  if (error || !data) return null;

  const challenge = mapDbChallengeToChallenge(data);

  // Get agent count
  const { count } = await getSupabaseClient()
    .from("challenge_agents")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challengeId);

  challenge.agentCount = count || 0;

  return challenge;
};

/**
 * Create a new challenge
 */
export const createChallenge = async (
  creatorWallet: string,
  challenge: {
    title: string;
    description: string;
    rules?: string;
    startTime: string;
    endTime: string;
    judgeEnd: string;
    entryFeeDot: string;
    escrowAddress?: string;
  }
): Promise<string | null> => {
  const challengeId = `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { error } = await getSupabaseClient()
    .from("challenges")
    .insert({
      challenge_id: challengeId,
      creator_wallet: creatorWallet,
      title: challenge.title,
      description: challenge.description,
      rules: challenge.rules || null,
      start_time: challenge.startTime,
      end_time: challenge.endTime,
      judge_end: challenge.judgeEnd,
      entry_fee_dot: challenge.entryFeeDot,
      escrow_address: challenge.escrowAddress || null,
      status: "enrolling",
    });

  if (error) {
    console.error("Failed to create challenge:", error.message);
    return null;
  }

  return challengeId;
};

/**
 * Update a challenge's status
 */
export const updateChallengeStatus = async (
  challengeId: string,
  status: ChallengeStatus,
  winnerAgentId?: string
): Promise<boolean> => {
  const updates: Record<string, unknown> = { status };
  if (winnerAgentId) {
    updates.winner_agent_id = winnerAgentId;
  }

  const { error } = await getSupabaseClient()
    .from("challenges")
    .update(updates)
    .eq("challenge_id", challengeId);

  return !error;
};

/**
 * Enroll an agent in a challenge
 */
export const enrollAgent = async (
  challengeId: string,
  ownerWallet: string,
  agent: {
    agentName: string;
    repoUrl: string;
    commitHash: string;
    endpointUrl: string;
    description?: string;
    entryTxHash: string;
  }
): Promise<string | null> => {
  const { data, error } = await getSupabaseClient()
    .from("challenge_agents")
    .insert({
      challenge_id: challengeId,
      owner_wallet: ownerWallet,
      agent_name: agent.agentName,
      repo_url: agent.repoUrl,
      commit_hash: agent.commitHash,
      endpoint_url: agent.endpointUrl,
      description: agent.description || null,
      entry_tx_hash: agent.entryTxHash,
      entry_verified: false,
      total_votes: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to enroll agent:", error?.message);
    return null;
  }

  return data.id;
};

/**
 * Get all agents enrolled in a challenge
 */
export const getChallengeAgents = async (challengeId: string): Promise<ChallengeAgent[]> => {
  const { data, error } = await getSupabaseClient()
    .from("challenge_agents")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("enrolled_at", { ascending: true });

  if (error || !data) return [];

  return data.map(mapDbAgentToAgent);
};

/**
 * Get a single agent by ID
 */
export const getChallengeAgent = async (agentId: string): Promise<ChallengeAgent | null> => {
  const { data, error } = await getSupabaseClient()
    .from("challenge_agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (error || !data) return null;

  return mapDbAgentToAgent(data);
};

/**
 * Cast a vote for an agent (one vote per wallet per challenge)
 */
export const castVote = async (
  challengeId: string,
  voterWallet: string,
  agentId: string
): Promise<boolean> => {
  // Insert the vote (UNIQUE constraint prevents duplicates)
  const { error: voteError } = await getSupabaseClient().from("challenge_votes").insert({
    challenge_id: challengeId,
    voter_wallet: voterWallet,
    agent_id: agentId,
  });

  if (voteError) {
    console.error("Failed to cast vote:", voteError.message);
    return false;
  }

  // Increment the agent's vote count
  const { error: rpcError } = await getSupabaseClient().rpc("increment_agent_votes", {
    p_agent_id: agentId,
  });

  if (rpcError) {
    console.error("Failed to increment agent votes:", rpcError.message);
  }

  return true;
};

/**
 * Check if a user has already voted in a challenge
 */
export const hasVoted = async (challengeId: string, voterWallet: string): Promise<boolean> => {
  const { data, error } = await getSupabaseClient()
    .from("challenge_votes")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("voter_wallet", voterWallet)
    .single();

  return !error && !!data;
};

/**
 * Get challenge results (agents sorted by total votes)
 */
export const getChallengeResults = async (challengeId: string): Promise<ChallengeAgent[]> => {
  const { data, error } = await getSupabaseClient()
    .from("challenge_agents")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("total_votes", { ascending: false });

  if (error || !data) return [];

  return data.map(mapDbAgentToAgent);
};

/**
 * Get all votes for a challenge
 */
export const getChallengeVotes = async (challengeId: string): Promise<ChallengeVote[]> => {
  const { data, error } = await getSupabaseClient()
    .from("challenge_votes")
    .select("*")
    .eq("challenge_id", challengeId);

  if (error || !data) return [];

  return data.map((v: DbChallengeVote) => ({
    challengeId: v.challenge_id,
    voter: v.voter_wallet,
    agentId: v.agent_id,
  }));
};

/**
 * Get all payouts for a challenge
 */
export const getChallengePayouts = async (challengeId: string): Promise<ChallengePayout[]> => {
  const { data, error } = await getSupabaseClient()
    .from("challenge_payouts")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((p: DbChallengePayout) => ({
    challengeId: p.challenge_id,
    recipient: p.recipient_wallet,
    amountDot: p.amount_dot,
    payoutType: p.payout_type as ChallengePayout["payoutType"],
    txHash: p.tx_hash || undefined,
    status: p.status as ChallengePayout["status"],
  }));
};

// ============================================================================
// Real-time Subscriptions
// ============================================================================

/**
 * Subscribe to new activities in a community
 */
export const subscribeToActivities = (
  communityId: string,
  callback: (activity: Activity) => void
) => {
  return getSupabaseClient()
    .channel(`activities:${communityId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "activities",
        filter: `community_id=eq.${communityId}`,
      },
      async (payload) => {
        const activity = await mapDbActivityToActivity(payload.new as DbActivity);
        callback(activity);
      }
    )
    .subscribe();
};

/**
 * Subscribe to new comments on an activity
 */
export const subscribeToComments = (activityId: string, callback: (comment: Comment) => void) => {
  return getSupabaseClient()
    .channel(`comments:${activityId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "comments",
        filter: `activity_id=eq.${activityId}`,
      },
      (payload) => {
        const c = payload.new as DbComment;
        callback({
          commentId: c.comment_id,
          publisher: c.publisher_wallet,
          content: c.content,
          timestamp: c.timestamp,
          likes: c.likes,
        });
      }
    )
    .subscribe();
};

/**
 * Unsubscribe from a channel
 */
export const unsubscribe = (subscription: ReturnType<typeof supabase.channel>) => {
  supabase.removeChannel(subscription);
};
