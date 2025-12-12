/**
 * API Route tests for /api/community/join
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  TEST_WALLET_ADDRESS,
  dbCommunityRecord,
  validTestJwt,
} from '../../setup/fixtures';

// Mock jose for JWT verification
vi.mock('jose', () => ({
  jwtVerify: vi.fn(async (token: string) => {
    if (token === 'valid_token' || token === validTestJwt) {
      return {
        payload: {
          wallet_address: TEST_WALLET_ADDRESS,
        },
      };
    }
    throw new Error('Invalid token');
  }),
}));

// Track mock calls
const mockSelectCommunity = vi.fn();
const mockSelectMember = vi.fn();
const mockInsertMember = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'communities') {
        return {
          select: mockSelectCommunity.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: dbCommunityRecord,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'community_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: mockSelectMember.mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null, // Not a member
                  error: null,
                }),
              }),
            }),
          }),
          insert: mockInsertMember.mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  })),
}));

// Import after mocking
import { POST } from '@/app/api/community/join/route';

describe('POST /api/community/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertMember.mockResolvedValue({ error: null });
    
    mockSelectCommunity.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: dbCommunityRecord,
          error: null,
        }),
      }),
    });
  });

  const createRequest = (body: unknown, authToken?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['authorization'] = `Bearer ${authToken}`;
    }
    return new NextRequest('http://localhost:3000/api/community/join', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  };

  describe('Authentication', () => {
    it('should return 401 without authorization header', async () => {
      const request = createRequest({ communityId: 'comm_test_123' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const request = createRequest({ communityId: 'comm_test_123' }, 'invalid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('Input Validation', () => {
    it('should return 400 if communityId is missing', async () => {
      const request = createRequest({}, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Community ID is required');
    });

    it('should return 404 if community does not exist', async () => {
      mockSelectCommunity.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      });

      const request = createRequest({ communityId: 'nonexistent' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Community not found');
    });
  });

  describe('Business Logic', () => {
    it('should return 400 if already a member', async () => {
      mockSelectMember.mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({
          data: { id: 'existing' }, // Already a member
          error: null,
        }),
      });

      const request = createRequest({ communityId: 'comm_test_123' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Already a member');
    });

    it('should successfully join community', async () => {
      const request = createRequest({ communityId: 'comm_test_123' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
    });

    it('should insert member record on success', async () => {
      const request = createRequest({ communityId: 'comm_test_123' }, 'valid_token');
      await POST(request);

      expect(mockInsertMember).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database insert error', async () => {
      mockInsertMember.mockResolvedValueOnce({
        error: { message: 'Database error' },
      });

      const request = createRequest({ communityId: 'comm_test_123' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to join community');
    });
  });
});

