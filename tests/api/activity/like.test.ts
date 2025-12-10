/**
 * API Route tests for /api/activity/like
 * Note: This endpoint does NOT require authentication (anonymous likes allowed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Define mock before vi.mock
const mockRpc = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({})),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}));

// Import after mocking
import { POST } from '@/app/api/activity/like/route';

describe('POST /api/activity/like', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  const createRequest = (body: unknown) => {
    return new NextRequest('http://localhost:3000/api/activity/like', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  describe('Input Validation', () => {
    it('should return 400 if activityId is missing', async () => {
      const request = createRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Activity ID is required');
    });

    it('should return 400 if activityId is empty string', async () => {
      const request = createRequest({ activityId: '' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Activity ID is required');
    });

    it('should return 400 if activityId is null', async () => {
      const request = createRequest({ activityId: null });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Activity ID is required');
    });
  });

  describe('Like Functionality', () => {
    it('should successfully like an activity without authentication', async () => {
      const request = createRequest({ activityId: 'act_test_1' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
    });

    it('should call increment_activity_likes RPC with correct parameter', async () => {
      const request = createRequest({ activityId: 'act_test_123' });
      await POST(request);

      expect(mockRpc).toHaveBeenCalledWith('increment_activity_likes', {
        p_activity_id: 'act_test_123',
      });
    });

    it('should handle RPC error gracefully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' },
      });

      const request = createRequest({ activityId: 'act_test_1' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to like activity');
    });

    it('should work with any valid activityId format', async () => {
      const activityIds = [
        'act_123',
        'act_test_456_abc',
        'activity-with-dashes',
        'a',
      ];

      for (const activityId of activityIds) {
        mockRpc.mockResolvedValueOnce({ data: null, error: null });
        const request = createRequest({ activityId });
        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/activity/like', {
        method: 'POST',
        body: 'not valid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should return 500 on unexpected error', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Unexpected error'));

      const request = createRequest({ activityId: 'act_test_1' });
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
