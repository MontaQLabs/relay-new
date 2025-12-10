/**
 * API Route tests for /api/activity/comment
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  TEST_WALLET_ADDRESS,
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
const mockSelectActivity = vi.fn();
const mockInsertComment = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'activities') {
        return {
          select: mockSelectActivity.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { activity_id: 'act_test_1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'comments') {
        return {
          insert: mockInsertComment.mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  })),
}));

// Import after mocking
import { POST } from '@/app/api/activity/comment/route';

describe('POST /api/activity/comment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertComment.mockResolvedValue({ error: null });
    mockSelectActivity.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { activity_id: 'act_test_1' },
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
    return new NextRequest('http://localhost:3000/api/activity/comment', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  };

  describe('Authentication', () => {
    it('should return 401 without authorization header', async () => {
      const request = createRequest({ activityId: 'act_test_1', content: 'Test comment' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const request = createRequest(
        { activityId: 'act_test_1', content: 'Test comment' },
        'invalid_token'
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('Input Validation', () => {
    it('should return 400 if activityId is missing', async () => {
      const request = createRequest({ content: 'Test comment' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Activity ID');
    });

    it('should return 400 if content is missing', async () => {
      const request = createRequest({ activityId: 'act_test_1' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 400 if content is empty', async () => {
      const request = createRequest({ activityId: 'act_test_1', content: '' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 400 if content is whitespace only', async () => {
      const request = createRequest({ activityId: 'act_test_1', content: '   ' }, 'valid_token');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 404 if activity does not exist', async () => {
      mockSelectActivity.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      });

      const request = createRequest(
        { activityId: 'nonexistent', content: 'Test comment' },
        'valid_token'
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Activity not found');
    });
  });

  describe('Comment Creation', () => {
    it('should successfully create a comment', async () => {
      const request = createRequest(
        { activityId: 'act_test_1', content: 'This is a test comment' },
        'valid_token'
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('commentId');
    });

    it('should insert comment with correct data', async () => {
      const request = createRequest(
        { activityId: 'act_test_1', content: 'This is a test comment' },
        'valid_token'
      );
      await POST(request);

      expect(mockInsertComment).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database insert error', async () => {
      mockInsertComment.mockResolvedValueOnce({
        error: { message: 'Database error' },
      });

      const request = createRequest(
        { activityId: 'act_test_1', content: 'Test comment' },
        'valid_token'
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create comment');
    });
  });
});
