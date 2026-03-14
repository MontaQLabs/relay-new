/**
 * API Route tests for /api/friends
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  TEST_WALLET_ADDRESS,
  TEST_WALLET_ADDRESS_2,
  dbFriendRecord,
  validTestJwt,
} from "../../setup/fixtures";

// Mock jose for JWT verification
vi.mock("jose", () => ({
  jwtVerify: vi.fn(async (token: string) => {
    if (token === "valid_token" || token === validTestJwt) {
      return {
        payload: {
          wallet_address: TEST_WALLET_ADDRESS,
        },
      };
    }
    throw new Error("Invalid token");
  }),
}));

// Track mock state
let mockFriendsData = [dbFriendRecord];
let mockExistingFriend: unknown = null;
let mockInsertError: unknown = null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "friends") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockFriendsData,
                error: null,
              }),
              single: vi.fn().mockResolvedValue({
                data: mockExistingFriend,
                error: mockExistingFriend ? null : { message: "Not found" },
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({
            error: mockInsertError,
          }),
        };
      }
      return {};
    }),
  })),
}));

// Import after mocking
import { GET, POST } from "@/app/api/friends/route";

describe("/api/friends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFriendsData = [dbFriendRecord];
    mockExistingFriend = null;
    mockInsertError = null;
  });

  const createGetRequest = (authToken?: string) => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["authorization"] = `Bearer ${authToken}`;
    }
    return new NextRequest("http://localhost:3000/api/friends", {
      method: "GET",
      headers,
    });
  };

  const createPostRequest = (body: unknown, authToken?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["authorization"] = `Bearer ${authToken}`;
    }
    return new NextRequest("http://localhost:3000/api/friends", {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  };

  describe("GET /api/friends", () => {
    it("should return 401 without authorization header", async () => {
      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should return 401 with invalid token", async () => {
      const request = createGetRequest("invalid_token");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should return friends list with valid token", async () => {
      const request = createGetRequest("valid_token");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("friends");
      expect(Array.isArray(data.friends)).toBe(true);
    });

    it("should return transformed friend objects", async () => {
      const request = createGetRequest("valid_token");
      const response = await GET(request);
      const data = await response.json();

      if (data.friends.length > 0) {
        const friend = data.friends[0];
        expect(friend).toHaveProperty("nickname");
        expect(friend).toHaveProperty("walletAddress");
        expect(friend).toHaveProperty("network");
        expect(friend).toHaveProperty("remark");
      }
    });

    it("should return empty array when no friends", async () => {
      mockFriendsData = [];

      const request = createGetRequest("valid_token");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.friends).toEqual([]);
    });
  });

  describe("POST /api/friends", () => {
    const validFriendData = {
      nickname: "New Friend",
      walletAddress: TEST_WALLET_ADDRESS_2,
      network: "Polkadot Asset Hub",
      remark: "Test remark",
    };

    it("should return 401 without authorization header", async () => {
      const request = createPostRequest(validFriendData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should return 400 if nickname is missing", async () => {
      const request = createPostRequest(
        { walletAddress: TEST_WALLET_ADDRESS_2, network: "Polkadot" },
        "valid_token"
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("required");
    });

    it("should return 400 if walletAddress is missing", async () => {
      const request = createPostRequest({ nickname: "Test", network: "Polkadot" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("required");
    });

    it("should return 400 if network is missing", async () => {
      const request = createPostRequest(
        { nickname: "Test", walletAddress: TEST_WALLET_ADDRESS_2 },
        "valid_token"
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("required");
    });
  });
});
