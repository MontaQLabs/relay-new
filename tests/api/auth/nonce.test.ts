/**
 * API Route tests for /api/auth/nonce
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  TEST_WALLET_ADDRESS,
  TEST_WALLET_ADDRESS_2,
} from '../../setup/fixtures';

// Mock Supabase
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'auth_nonces') {
        return {
          insert: mockInsert.mockReturnValue(Promise.resolve({ error: null })),
          delete: vi.fn().mockReturnValue({
            eq: mockEq.mockReturnValue(Promise.resolve({ error: null })),
          }),
        };
      }
      return {};
    }),
  })),
}));

// Import after mocking
import { POST } from '@/app/api/auth/nonce/route';

describe('POST /api/auth/nonce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue(Promise.resolve({ error: null }));
  });

  const createRequest = (body: unknown) => {
    return new NextRequest('http://localhost:3000/api/auth/nonce', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  it('should return 400 if walletAddress is missing', async () => {
    const request = createRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should return 400 for invalid wallet address format', async () => {
    const request = createRequest({ walletAddress: 'invalid' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid wallet address');
  });

  it('should return nonce and message for valid wallet address', async () => {
    const request = createRequest({ walletAddress: TEST_WALLET_ADDRESS });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('nonce');
    expect(data).toHaveProperty('message');
    expect(data.nonce).toBeTruthy();
    expect(data.message).toContain(TEST_WALLET_ADDRESS);
  });

  it('should return message containing the nonce', async () => {
    const request = createRequest({ walletAddress: TEST_WALLET_ADDRESS });
    const response = await POST(request);
    const data = await response.json();

    expect(data.message).toContain(data.nonce);
  });

  it('should return message with authentication text', async () => {
    const request = createRequest({ walletAddress: TEST_WALLET_ADDRESS });
    const response = await POST(request);
    const data = await response.json();

    expect(data.message).toContain('Sign this message to authenticate');
  });

  it('should handle database error gracefully', async () => {
    mockInsert.mockReturnValueOnce(
      Promise.resolve({ error: { message: 'Database error' } })
    );

    const request = createRequest({ walletAddress: TEST_WALLET_ADDRESS });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to generate');
  });

  it('should accept second valid wallet address', async () => {
    const request = createRequest({ walletAddress: TEST_WALLET_ADDRESS_2 });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('nonce');
  });

  it('should generate unique nonces on subsequent requests', async () => {
    const request1 = createRequest({ walletAddress: TEST_WALLET_ADDRESS });
    const request2 = createRequest({ walletAddress: TEST_WALLET_ADDRESS });

    const response1 = await POST(request1);
    const response2 = await POST(request2);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.nonce).not.toBe(data2.nonce);
  });
});

