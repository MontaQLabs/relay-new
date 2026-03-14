/**
 * API Route tests for /api/activity/leave
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TEST_WALLET_ADDRESS, validTestJwt } from "../../setup/fixtures";

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

// Track mock calls
const mockDeleteAttendee = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "activity_attendees") {
        return {
          delete: mockDeleteAttendee.mockReturnValue({
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
import { POST } from "@/app/api/activity/leave/route";

describe("POST /api/activity/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteAttendee.mockReturnValue({
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
    return new NextRequest("http://localhost:3000/api/activity/leave", {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  };

  describe("Authentication", () => {
    it("should return 401 without authorization header", async () => {
      const request = createRequest({ activityId: "act_test_1" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should return 401 with invalid token", async () => {
      const request = createRequest({ activityId: "act_test_1" }, "invalid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });
  });

  describe("Input Validation", () => {
    it("should return 400 if activityId is missing", async () => {
      const request = createRequest({}, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Activity ID is required");
    });
  });

  describe("Leave Functionality", () => {
    it("should successfully leave activity", async () => {
      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("success", true);
    });

    it("should call delete on attendees table", async () => {
      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      await POST(request);

      expect(mockDeleteAttendee).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle database delete error", async () => {
      mockDeleteAttendee.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: "Database error" },
          }),
        }),
      });

      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to leave activity");
    });

    it("should handle malformed JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/activity/leave", {
        method: "POST",
        body: "not valid json",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer valid_token",
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });
});
