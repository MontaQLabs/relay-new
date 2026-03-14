/**
 * API Route tests for /api/community
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  TEST_WALLET_ADDRESS,
  TEST_WALLET_ADDRESS_2,
  dbCommunityRecord,
} from "../../setup/fixtures";

// Mock data
const mockCommunities = [
  dbCommunityRecord,
  {
    ...dbCommunityRecord,
    community_id: "comm_test_456",
    name: "Another Community",
    owner_wallet: TEST_WALLET_ADDRESS_2,
  },
];

const mockCommunityMembers = [
  { community_id: "comm_test_123", user_wallet: TEST_WALLET_ADDRESS },
  { community_id: "comm_test_456", user_wallet: TEST_WALLET_ADDRESS },
];

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "communities") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCommunities,
              error: null,
            }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [dbCommunityRecord],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "community_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockCommunityMembers.map((m) => ({
                community_id: m.community_id,
                communities: mockCommunities.find((c) => c.community_id === m.community_id),
              })),
              error: null,
            }),
            count: "exact",
            head: true,
          }),
        };
      }
      if (table === "activities") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ activity_id: "act_1" }],
              error: null,
            }),
          }),
        };
      }
      return {};
    }),
  })),
}));

// Import after mocking
import { GET } from "@/app/api/community/route";

describe("GET /api/community", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (params: Record<string, string>) => {
    const url = new URL("http://localhost:3000/api/community");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  describe("Input Validation", () => {
    it("should return 400 if type parameter is missing", async () => {
      const request = createRequest({});
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid type parameter");
    });

    it("should return 400 if type is invalid", async () => {
      const request = createRequest({ type: "invalid" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid type parameter");
    });

    it("should return 400 if wallet is missing for joined type", async () => {
      const request = createRequest({ type: "joined" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Wallet address is required");
    });

    it("should return 400 if wallet is missing for created type", async () => {
      const request = createRequest({ type: "created" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Wallet address is required");
    });
  });

  describe("Fetching Communities", () => {
    it("should return all communities when type=all", async () => {
      const request = createRequest({ type: "all" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("communities");
      expect(Array.isArray(data.communities)).toBe(true);
    });

    it("should return created communities when type=created", async () => {
      const request = createRequest({
        type: "created",
        wallet: TEST_WALLET_ADDRESS,
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("communities");
    });

    it("should return joined communities when type=joined", async () => {
      const request = createRequest({
        type: "joined",
        wallet: TEST_WALLET_ADDRESS,
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("communities");
    });

    it("should include community details in response", async () => {
      const request = createRequest({ type: "all" });
      const response = await GET(request);
      const data = await response.json();

      if (data.communities.length > 0) {
        const community = data.communities[0];
        expect(community).toHaveProperty("name");
        expect(community).toHaveProperty("communityId");
        expect(community).toHaveProperty("owner");
      }
    });
  });

  describe("Valid Type Values", () => {
    it("should accept type=all", async () => {
      const request = createRequest({ type: "all" });
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it("should accept type=joined with wallet", async () => {
      const request = createRequest({
        type: "joined",
        wallet: TEST_WALLET_ADDRESS,
      });
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it("should accept type=created with wallet", async () => {
      const request = createRequest({
        type: "created",
        wallet: TEST_WALLET_ADDRESS,
      });
      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });
});
