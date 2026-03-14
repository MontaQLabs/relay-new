/**
 * Test fixtures for consistent test data
 */

import type {
  Community,
  Activity,
  Friend,
  Transaction,
  User,
  Wallet,
  KnownAsset,
  Coin,
} from "@/app/types/frontend_type";

// Test wallet addresses
export const TEST_WALLET_ADDRESS = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5";
export const TEST_WALLET_ADDRESS_2 = "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3";
export const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// Test wallet
export const testWallet: Wallet = {
  address: TEST_WALLET_ADDRESS,
  network: "Polkadot Asset Hub",
  coins: [],
  status: "active",
  isBackedUp: false,
};

// Test user
export const testUser: User = {
  avatar: "https://example.com/avatar.png",
  nickname: "TestUser",
  wallet: testWallet,
  friends: [],
  socialRecovery: [],
  transactions: [],
  communities: [],
  activities: [],
};

// Test friends
export const testFriend: Friend = {
  nickname: "Alice",
  walletAddress: TEST_WALLET_ADDRESS_2,
  network: "Polkadot Asset Hub",
  remark: "My friend Alice",
};

export const testFriends: Friend[] = [
  testFriend,
  {
    nickname: "Bob",
    walletAddress: "1234567890abcdef1234567890abcdef1234567890abcdef",
    network: "Polkadot Asset Hub",
    remark: "Work colleague",
  },
];

// Test communities
export const testCommunity: Community = {
  owner: TEST_WALLET_ADDRESS,
  name: "Test Community",
  description: "A test community for unit testing purposes with enough words",
  avatar: "https://example.com/community.png",
  communityId: "comm_test_123",
  rules: "Be nice to each other",
  activityTypes: ["Meeting", "Social"],
  allowInvestment: true,
  activities: ["act_test_1", "act_test_2"],
  memberCount: 10,
};

export const testCommunities: Community[] = [
  testCommunity,
  {
    owner: TEST_WALLET_ADDRESS_2,
    name: "Another Community",
    description: "Another community for testing join functionality",
    avatar: "",
    communityId: "comm_test_456",
    activityTypes: ["Workshop"],
    allowInvestment: false,
    activities: [],
    memberCount: 5,
  },
];

// Test activities
export const testActivity: Activity = {
  communityId: "comm_test_123",
  activityId: "act_test_1",
  owner: TEST_WALLET_ADDRESS,
  title: "Test Activity",
  description: "A test activity for testing purposes",
  isPaid: false,
  timestamp: new Date().toISOString(),
  type: "Meeting",
  maxAttendees: 10,
  pictures: [],
  attendees: [TEST_WALLET_ADDRESS],
  comments: [],
  likes: 5,
  status: "open",
};

export const testActivityFull: Activity = {
  ...testActivity,
  activityId: "act_test_full",
  title: "Full Activity",
  maxAttendees: 2,
  attendees: [TEST_WALLET_ADDRESS, TEST_WALLET_ADDRESS_2],
  status: "full",
};

// Test transactions
export const testTransaction: Transaction = {
  id: "tx_test_123",
  sender: "TestUser",
  senderAddress: TEST_WALLET_ADDRESS,
  receiver: "Alice",
  receiverAddress: TEST_WALLET_ADDRESS_2,
  network: "Polkadot Asset Hub",
  ticker: "DOT",
  amount: 1.5,
  amountFiat: 10.5,
  fee: 0.001,
  feesFiat: 0.01,
  timestamp: new Date().toISOString(),
  status: "completed",
  type: "sent",
};

export const testTransactions: Transaction[] = [
  testTransaction,
  {
    ...testTransaction,
    id: "tx_test_456",
    type: "received",
    sender: "Alice",
    senderAddress: TEST_WALLET_ADDRESS_2,
    receiver: "TestUser",
    receiverAddress: TEST_WALLET_ADDRESS,
  },
];

// Test coins
export const testCoins: Coin[] = [
  {
    ticker: "DOT",
    amount: 10.5,
    change: 2.5,
    symbol: "https://example.com/dot.png",
    fiatValue: 75.25,
  },
  {
    ticker: "USDt",
    amount: 100,
    change: 0,
    symbol: "https://example.com/usdt.png",
    fiatValue: 100,
  },
];

// Test known assets
export const testKnownAssets: KnownAsset[] = [
  {
    id: 1984,
    ticker: "USDt",
    decimals: 6,
    symbol: "https://example.com/usdt.png",
    category: "stablecoin",
  },
  {
    id: 1337,
    ticker: "USDC",
    decimals: 6,
    symbol: "https://example.com/usdc.png",
    category: "stablecoin",
  },
  {
    id: 30,
    ticker: "DED",
    decimals: 10,
    symbol: "https://example.com/ded.png",
    category: "meme",
  },
];

// Database record fixtures (matching Supabase schema)
export const dbUserRecord = {
  id: "uuid-123",
  wallet_address: TEST_WALLET_ADDRESS,
  avatar: "https://example.com/avatar.png",
  nickname: "TestUser",
  created_at: new Date().toISOString(),
  last_login: new Date().toISOString(),
};

export const dbFriendRecord = {
  id: "uuid-friend-123",
  user_wallet: TEST_WALLET_ADDRESS,
  nickname: "Alice",
  wallet_address: TEST_WALLET_ADDRESS_2,
  network: "Polkadot Asset Hub",
  remark: "My friend Alice",
  created_at: new Date().toISOString(),
};

export const dbCommunityRecord = {
  id: "uuid-comm-123",
  community_id: "comm_test_123",
  owner_wallet: TEST_WALLET_ADDRESS,
  name: "Test Community",
  description: "A test community",
  avatar: "https://example.com/community.png",
  rules: "Be nice",
  activity_types: ["Meeting", "Social"],
  allow_investment: true,
  created_at: new Date().toISOString(),
};

export const dbActivityRecord = {
  id: "uuid-act-123",
  activity_id: "act_test_1",
  community_id: "comm_test_123",
  owner_wallet: TEST_WALLET_ADDRESS,
  title: "Test Activity",
  description: "A test activity",
  is_paid: false,
  timestamp: new Date().toISOString(),
  type: "Meeting",
  max_attendees: 10,
  pictures: [],
  status: "open",
  currency: null,
  amount: null,
  likes: 5,
  created_at: new Date().toISOString(),
};

export const dbNonceRecord = {
  id: "uuid-nonce-123",
  wallet_address: TEST_WALLET_ADDRESS,
  nonce: "a1b2c3d4e5f6",
  message: `Sign this message to authenticate with Relay.\n\nNonce: a1b2c3d4e5f6\nWallet: ${TEST_WALLET_ADDRESS}\nTimestamp: 2024-01-01T00:00:00.000Z\n\nThis signature will not trigger any blockchain transaction or cost any fees.`,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
};

export const dbExpiredNonceRecord = {
  ...dbNonceRecord,
  expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
};

// JWT test tokens
export const testJwtPayload = {
  wallet_address: TEST_WALLET_ADDRESS,
  role: "authenticated",
  aud: "authenticated",
  sub: TEST_WALLET_ADDRESS,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
};

export const expiredJwtPayload = {
  ...testJwtPayload,
  exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
};

// Helper to create mock JWT token (base64 encoded)
export const createMockJwt = (payload: Record<string, unknown>): string => {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = "mock_signature";
  return `${headerB64}.${payloadB64}.${signature}`;
};

export const validTestJwt = createMockJwt(testJwtPayload);
export const expiredTestJwt = createMockJwt(expiredJwtPayload);
