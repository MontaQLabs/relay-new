/**
 * Supabase client mocks for testing
 */

import { vi } from 'vitest';

// Mock Supabase query builder
export const createMockQueryBuilder = (data: unknown = null, error: unknown = null) => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn().mockResolvedValue({ data, error }),
  };
  
  // Make the builder itself return the resolved value when awaited
  return Object.assign(Promise.resolve({ data, error }), builder);
};

// Mock Supabase client
export const createMockSupabaseClient = () => {
  return {
    from: vi.fn(() => createMockQueryBuilder()),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  };
};

// Mock Supabase admin client (for API routes)
export const mockSupabaseAdmin = createMockSupabaseClient();

// Helper to mock specific query results
export const mockQueryResult = (
  mockClient: ReturnType<typeof createMockSupabaseClient>,
  tableName: string,
  data: unknown,
  error: unknown = null
) => {
  mockClient.from.mockImplementation((table: string) => {
    if (table === tableName) {
      return createMockQueryBuilder(data, error);
    }
    return createMockQueryBuilder();
  });
};

