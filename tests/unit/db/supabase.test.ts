/**
 * Unit tests for app/db/supabase.ts - Database layer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_WALLET_ADDRESS,
  TEST_WALLET_ADDRESS_2,
  testWallet,
  validTestJwt,
} from '../../setup/fixtures';
import { WALLET_KEY } from '@/app/types/constants';

// Define mock functions before vi.mock
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  })),
}));

// Import after mocking
import {
  getUserNickname,
  getUserNicknames,
  isUserCommunityMember,
  getCommunityMemberCount,
} from '@/app/db/supabase';

describe('Supabase Database Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(WALLET_KEY, JSON.stringify(testWallet));
    localStorage.setItem('relay-auth-token', validTestJwt);
  });

  describe('getUserNickname', () => {
    it('should return nickname when user exists', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { nickname: 'TestUser' },
              error: null,
            }),
          }),
        }),
      });

      const nickname = await getUserNickname(TEST_WALLET_ADDRESS);
      expect(nickname).toBe('TestUser');
    });

    it('should return truncated address when no nickname', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const nickname = await getUserNickname(TEST_WALLET_ADDRESS);
      expect(nickname).toContain('...');
      expect(nickname.length).toBeLessThan(TEST_WALLET_ADDRESS.length);
    });

    it('should return truncated address when nickname is null', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { nickname: null },
              error: null,
            }),
          }),
        }),
      });

      const nickname = await getUserNickname(TEST_WALLET_ADDRESS);
      expect(nickname).toContain('...');
    });
  });

  describe('getUserNicknames', () => {
    it('should return empty object for empty input', async () => {
      const result = await getUserNicknames([]);
      expect(result).toEqual({});
    });

    it('should return nicknames for multiple addresses', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { wallet_address: TEST_WALLET_ADDRESS, nickname: 'User1' },
              { wallet_address: TEST_WALLET_ADDRESS_2, nickname: 'User2' },
            ],
            error: null,
          }),
        }),
      });

      const result = await getUserNicknames([TEST_WALLET_ADDRESS, TEST_WALLET_ADDRESS_2]);
      expect(result[TEST_WALLET_ADDRESS]).toBe('User1');
      expect(result[TEST_WALLET_ADDRESS_2]).toBe('User2');
    });

    it('should use truncated address as fallback for missing nicknames', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { wallet_address: TEST_WALLET_ADDRESS, nickname: 'User1' },
            ],
            error: null,
          }),
        }),
      });

      const result = await getUserNicknames([TEST_WALLET_ADDRESS, TEST_WALLET_ADDRESS_2]);
      expect(result[TEST_WALLET_ADDRESS]).toBe('User1');
      expect(result[TEST_WALLET_ADDRESS_2]).toContain('...');
    });
  });

  describe('isUserCommunityMember', () => {
    it('should return true when user is a member', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'member_123' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const isMember = await isUserCommunityMember('comm_123', TEST_WALLET_ADDRESS);
      expect(isMember).toBe(true);
    });

    it('should return false when user is not a member', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      });

      const isMember = await isUserCommunityMember('comm_123', TEST_WALLET_ADDRESS);
      expect(isMember).toBe(false);
    });
  });

  describe('getCommunityMemberCount', () => {
    it('should return member count', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 42,
            error: null,
          }),
        }),
      });

      const count = await getCommunityMemberCount('comm_123');
      expect(count).toBe(42);
    });

    it('should return 0 on error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: null,
            error: { message: 'Error' },
          }),
        }),
      });

      const count = await getCommunityMemberCount('comm_123');
      expect(count).toBe(0);
    });

    it('should return 0 when count is null', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: null,
            error: null,
          }),
        }),
      });

      const count = await getCommunityMemberCount('comm_123');
      expect(count).toBe(0);
    });
  });
});
