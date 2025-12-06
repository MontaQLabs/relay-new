/**
 * Supabase Database Operations
 * This file provides all database operations for the Relay app.
 * 
 * Prerequisites:
 * - Set up Supabase project and run the SQL schema (see supabase-schema.sql)
 * - Configure environment variables (see SETUP.md)
 * - User must be authenticated before calling these functions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  User,
  Friend,
  Transaction,
  Community,
  CommunityToken,
  Activity,
  Comment,
  ActivityStatus,
} from '../types/frontend_type';

// ============================================================================
// Supabase Client Setup
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Storage key for auth token
const AUTH_TOKEN_STORAGE_KEY = 'relay-auth-token';

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
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  }
  
  // Create authenticated client with the custom JWT
  authenticatedClient = createAuthenticatedClient(token);
};

// Clear auth session
export const clearSupabaseAuth = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
  authenticatedClient = null;
};

// Restore auth session from stored token (call on app initialization)
export const restoreSupabaseAuth = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return false;
  
  // Check if token is expired
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
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
  avatar: string | null;
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
    ? JSON.parse(atob(session.session.access_token.split('.')[1])).wallet_address
    : null;

  if (!walletAddress) return null;

  return getUserByWallet(walletAddress);
};

/**
 * Get user profile by wallet address
 */
export const getUserByWallet = async (walletAddress: string): Promise<User | null> => {
  const { data: dbUser, error } = await getSupabaseClient()
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
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
    avatar: dbUser.avatar || '',
    nickname: dbUser.nickname || '',
    wallet: {
      address: walletAddress,
      network: 'Polkadot Asset Hub',
      status: 'active',
      isBackedUp: true,
    },
    friends,
    socialRecovery,
    transactions,
    communities,
    activities: activities.map(a => a.activityId),
  };
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  walletAddress: string,
  updates: { avatar?: string; nickname?: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('users')
    .update({
      avatar: updates.avatar,
      nickname: updates.nickname,
    })
    .eq('wallet_address', walletAddress);

  return !error;
};

/**
 * Create or update user (upsert)
 */
export const upsertUser = async (
  walletAddress: string,
  data?: { avatar?: string; nickname?: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('users')
    .upsert({
      wallet_address: walletAddress,
      avatar: data?.avatar,
      nickname: data?.nickname,
      last_login: new Date().toISOString(),
    }, {
      onConflict: 'wallet_address',
    });

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
    .from('friends')
    .select('*')
    .eq('user_wallet', walletAddress)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((f: DbFriend) => ({
    nickname: f.nickname,
    walletAddress: f.wallet_address,
    network: f.network,
    remark: f.remark || '',
  }));
};

/**
 * Add a new friend
 */
export const addFriend = async (
  userWallet: string,
  friend: Friend
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('friends')
    .insert({
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
    .from('friends')
    .update({
      nickname: updates.nickname,
      network: updates.network,
      remark: updates.remark,
    })
    .eq('user_wallet', userWallet)
    .eq('wallet_address', friendWalletAddress);

  return !error;
};

/**
 * Remove a friend
 */
export const removeFriend = async (
  userWallet: string,
  friendWalletAddress: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('friends')
    .delete()
    .eq('user_wallet', userWallet)
    .eq('wallet_address', friendWalletAddress);

  return !error;
};

// ============================================================================
// Community Operations
// ============================================================================

/**
 * Get all communities (public)
 */
export const getAllCommunities = async (): Promise<Community[]> => {
  const { data, error } = await getSupabaseClient()
    .from('communities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Get activities for each community
  const communitiesWithActivities = await Promise.all(
    data.map(async (c: DbCommunity) => {
      const activities = await getCommunityActivities(c.community_id);
      return {
        owner: c.owner_wallet,
        name: c.name,
        avatar: c.avatar || '',
        communityId: c.community_id,
        activities: activities.map(a => a.activityId),
      };
    })
  );

  return communitiesWithActivities;
};

/**
 * Get communities that a user is a member of
 */
export const getUserCommunities = async (walletAddress: string): Promise<Community[]> => {
  const { data, error } = await getSupabaseClient()
    .from('community_members')
    .select(`
      community_id,
      communities (*)
    `)
    .eq('user_wallet', walletAddress);

  if (error || !data) return [];

  const communitiesWithActivities = await Promise.all(
    data.map(async (item) => {
      const c = item.communities as unknown as DbCommunity;
      const activities = await getCommunityActivities(c.community_id);
      return {
        owner: c.owner_wallet,
        name: c.name,
        avatar: c.avatar || '',
        communityId: c.community_id,
        activities: activities.map(a => a.activityId),
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
    .from('communities')
    .select('*')
    .eq('community_id', communityId)
    .single();

  if (error || !data) return null;

  const activities = await getCommunityActivities(communityId);
  const token = await getCommunityToken(communityId);

  return {
    owner: data.owner_wallet,
    name: data.name,
    avatar: data.avatar || '',
    communityId: data.community_id,
    activities: activities.map(a => a.activityId),
    token: token || undefined,
  };
};

/**
 * Create a new community
 */
export const createCommunity = async (
  ownerWallet: string,
  community: Omit<Community, 'owner' | 'activities'>
): Promise<string | null> => {
  const communityId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { error } = await getSupabaseClient()
    .from('communities')
    .insert({
      community_id: communityId,
      owner_wallet: ownerWallet,
      name: community.name,
      avatar: community.avatar,
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
  updates: { name?: string; avatar?: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('communities')
    .update({
      name: updates.name,
      avatar: updates.avatar,
    })
    .eq('community_id', communityId);

  return !error;
};

/**
 * Delete a community (owner only - enforced by RLS)
 */
export const deleteCommunity = async (communityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('communities')
    .delete()
    .eq('community_id', communityId);

  return !error;
};

/**
 * Join a community
 */
export const joinCommunity = async (
  communityId: string,
  userWallet: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('community_members')
    .insert({
      community_id: communityId,
      user_wallet: userWallet,
    });

  return !error;
};

/**
 * Leave a community
 */
export const leaveCommunity = async (
  communityId: string,
  userWallet: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_wallet', userWallet);

  return !error;
};

/**
 * Get community members
 */
export const getCommunityMembers = async (communityId: string): Promise<string[]> => {
  const { data, error } = await getSupabaseClient()
    .from('community_members')
    .select('user_wallet')
    .eq('community_id', communityId);

  if (error || !data) return [];

  return data.map((m: { user_wallet: string }) => m.user_wallet);
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
    .from('community_tokens')
    .select('*')
    .eq('community_id', communityId)
    .single();

  if (error || !data) return null;

  return mapDbCommunityTokenToToken(data);
};

/**
 * Create a community token (owner only - enforced by RLS)
 */
export const createCommunityToken = async (
  communityId: string,
  token: Omit<CommunityToken, 'createdAt' | 'isFrozen' | 'totalSupply'> & { totalSupply?: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('community_tokens')
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
    .from('community_tokens')
    .update(dbUpdates)
    .eq('community_id', communityId);

  return !error;
};

/**
 * Delete a community token (owner only - enforced by RLS)
 */
export const deleteCommunityToken = async (communityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('community_tokens')
    .delete()
    .eq('community_id', communityId);

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
    .from('community_tokens')
    .update({ total_supply: newSupply })
    .eq('community_id', communityId);

  return !error;
};

/**
 * Set token frozen status
 */
export const setTokenFrozen = async (
  communityId: string,
  isFrozen: boolean
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('community_tokens')
    .update({ is_frozen: isFrozen })
    .eq('community_id', communityId);

  return !error;
};

/**
 * Check if an asset ID is already in use
 */
export const isAssetIdAvailable = async (assetId: number): Promise<boolean> => {
  const { data, error } = await getSupabaseClient()
    .from('community_tokens')
    .select('id')
    .eq('asset_id', assetId)
    .single();

  // If error or no data, the asset ID is available
  return !!error || !data;
};

// ============================================================================
// Activity Operations
// ============================================================================

/**
 * Get all activities in a community
 */
export const getCommunityActivities = async (communityId: string): Promise<Activity[]> => {
  const { data, error } = await getSupabaseClient()
    .from('activities')
    .select('*')
    .eq('community_id', communityId)
    .order('timestamp', { ascending: false });

  if (error || !data) return [];

  return Promise.all(data.map(mapDbActivityToActivity));
};

/**
 * Get activities that a user is attending or owns
 */
export const getUserActivities = async (walletAddress: string): Promise<Activity[]> => {
  // Get activities the user owns
  const { data: ownedData } = await getSupabaseClient()
    .from('activities')
    .select('*')
    .eq('owner_wallet', walletAddress);

  // Get activities the user is attending
  const { data: attendingData } = await getSupabaseClient()
    .from('activity_attendees')
    .select(`
      activity_id,
      activities (*)
    `)
    .eq('user_wallet', walletAddress);

  const activities: DbActivity[] = [];

  if (ownedData) {
    activities.push(...ownedData);
  }

  if (attendingData) {
    attendingData.forEach((item) => {
      const activity = item.activities as unknown as DbActivity;
      if (activity && !activities.find(a => a.activity_id === activity.activity_id)) {
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
    .from('activities')
    .select('*')
    .eq('activity_id', activityId)
    .single();

  if (error || !data) return null;

  return mapDbActivityToActivity(data);
};

/**
 * Create a new activity
 */
export const createActivity = async (
  ownerWallet: string,
  activity: Omit<Activity, 'activityId' | 'owner' | 'attendees' | 'comments' | 'likes'>
): Promise<string | null> => {
  const activityId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const { error } = await getSupabaseClient()
    .from('activities')
    .insert({
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

  if (error) return null;

  // Add owner as an attendee
  await joinActivity(activityId, ownerWallet);

  return activityId;
};

/**
 * Update an activity (owner only - enforced by RLS)
 */
export const updateActivity = async (
  activityId: string,
  updates: Partial<Omit<Activity, 'activityId' | 'communityId' | 'owner' | 'attendees' | 'comments'>>
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('activities')
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
    .eq('activity_id', activityId);

  return !error;
};

/**
 * Delete an activity (owner only - enforced by RLS)
 */
export const deleteActivity = async (activityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('activities')
    .delete()
    .eq('activity_id', activityId);

  return !error;
};

/**
 * Join an activity
 */
export const joinActivity = async (
  activityId: string,
  userWallet: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('activity_attendees')
    .insert({
      activity_id: activityId,
      user_wallet: userWallet,
    });

  return !error;
};

/**
 * Leave an activity
 */
export const leaveActivity = async (
  activityId: string,
  userWallet: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('activity_attendees')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_wallet', userWallet);

  return !error;
};

/**
 * Like an activity
 */
export const likeActivity = async (activityId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient().rpc('increment_activity_likes', {
    p_activity_id: activityId,
  });

  return !error;
};

/**
 * Get activity attendees
 */
export const getActivityAttendees = async (activityId: string): Promise<string[]> => {
  const { data, error } = await getSupabaseClient()
    .from('activity_attendees')
    .select('user_wallet')
    .eq('activity_id', activityId);

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
    description: dbActivity.description || '',
    isPaid: dbActivity.is_paid,
    timestamp: dbActivity.timestamp,
    type: dbActivity.type,
    maxAttendees: dbActivity.max_attendees,
    pictures: dbActivity.pictures || [],
    attendees,
    comments: comments.map(c => c.commentId),
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
    .from('comments')
    .select('*')
    .eq('activity_id', activityId)
    .order('timestamp', { ascending: true });

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
    .from('comments')
    .select('*')
    .eq('comment_id', commentId)
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

  const { error } = await getSupabaseClient()
    .from('comments')
    .insert({
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
export const updateComment = async (
  commentId: string,
  content: string
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('comments')
    .update({ content })
    .eq('comment_id', commentId);

  return !error;
};

/**
 * Delete a comment (publisher only - enforced by RLS)
 */
export const deleteComment = async (commentId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('comments')
    .delete()
    .eq('comment_id', commentId);

  return !error;
};

/**
 * Like a comment
 */
export const likeComment = async (commentId: string): Promise<boolean> => {
  const { error } = await getSupabaseClient().rpc('increment_comment_likes', {
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
    .from('transactions')
    .select('*')
    .or(`sender_wallet.eq.${walletAddress},receiver_wallet.eq.${walletAddress}`)
    .order('timestamp', { ascending: false });

  if (error || !data) return [];

  return data.map((t: DbTransaction) => ({
    id: t.tx_id,
    sender: t.sender_nickname || 'Unknown',
    senderAddress: t.sender_wallet,
    receiver: t.receiver_nickname || 'Unknown',
    receiverAddress: t.receiver_wallet,
    network: t.network,
    amountFiat: t.amount_fiat,
    feesFiat: t.fees_fiat,
    timestamp: t.timestamp,
  }));
};

/**
 * Record a new transaction (called after blockchain confirmation)
 */
export const recordTransaction = async (
  transaction: Omit<Transaction, 'id'> & { txHash: string }
): Promise<boolean> => {
  const { error } = await getSupabaseClient()
    .from('transactions')
    .insert({
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
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activities',
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
export const subscribeToComments = (
  activityId: string,
  callback: (comment: Comment) => void
) => {
  return getSupabaseClient()
    .channel(`comments:${activityId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
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
