/**
 * API Route tests for /api/community/leave
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TEST_WALLET_ADDRESS, TEST_WALLET_ADDRESS_2, validTestJwt } from "../../setup/fixtures";

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
    if (token === "owner_token") {
      return {
        payload: {
          wallet_address: TEST_WALLET_ADDRESS_2,
        },
      };
    }
    throw new Error("Invalid token");
  }),
}));

// Track mock calls
const mockSelectCommunity = vi.fn();
const mockSelectMember = vi.fn();
const mockDeleteMember = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "communities") {
        return {
          select: mockSelectCommunity.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { community_id: "comm_test_123", owner_wallet: TEST_WALLET_ADDRESS_2 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "community_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: mockSelectMember.mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "member_123" },
                  error: null,
                }),
              }),
            }),
          }),
          delete: mockDeleteMember.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  })),
}));

// Import after mocking
import { POST } from "@/app/api/community/leave/route";

describe("POST /api/community/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMember.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  const createRequest = (body: unknown, authToken?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["authorization"] = `Bearer ${authToken}`;
    }
    return new NextRequest("http://localhost:3000/api/community/leave", {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  };

  describe("Authentication", () => {
    it("should return 401 without authorization header", async () => {
      const request = createRequest({ communityId: "comm_test_123" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should return 401 with invalid token", async () => {
      const request = createRequest({ communityId: "comm_test_123" }, "invalid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });
  });

  describe("Input Validation", () => {
    it("should return 400 if communityId is missing", async () => {
      const request = createRequest({}, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Community ID is required");
    });

    it("should return 404 if community does not exist", async () => {
      mockSelectCommunity.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        }),
      });

      const request = createRequest({ communityId: "nonexistent" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Community not found");
    });
  });

  describe("Business Logic", () => {
    it("should return 400 if not a member", async () => {
      mockSelectMember.mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      });

      const request = createRequest({ communityId: "comm_test_123" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("not a member");
    });

    it("should return 400 if owner tries to leave", async () => {
      const request = createRequest({ communityId: "comm_test_123" }, "owner_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("owners cannot leave");
    });

    it("should successfully leave community", async () => {
      const request = createRequest({ communityId: "comm_test_123" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("success", true);
    });
  });

  describe("Error Handling", () => {
    it("should handle database delete error", async () => {
      mockDeleteMember.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: "Database error" },
          }),
        }),
      });

      const request = createRequest({ communityId: "comm_test_123" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to leave community");
    });
  });
});
