/**
 * API Route tests for /api/activity/join
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  TEST_WALLET_ADDRESS,
  TEST_WALLET_ADDRESS_2,
  dbActivityRecord,
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
    if (token === "user2_token") {
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
const mockSelectActivity = vi.fn();
const mockSelectAttendee = vi.fn();
const mockSelectCount = vi.fn();
const mockInsertAttendee = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "activities") {
        return {
          select: mockSelectActivity.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  activity_id: dbActivityRecord.activity_id,
                  max_attendees: 10,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "activity_attendees") {
        return {
          select: vi
            .fn()
            .mockImplementation(
              (selectStr: string, options?: { count?: string; head?: boolean }) => {
                if (options?.count === "exact") {
                  // Count query
                  return {
                    eq: mockSelectCount.mockResolvedValue({
                      count: 5,
                      error: null,
                    }),
                  };
                }
                // Regular select (checking existing attendee)
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: mockSelectAttendee.mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: null, // Not already attending
                        error: null,
                      }),
                    }),
                  }),
                };
              }
            ),
          insert: mockInsertAttendee.mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  })),
}));

// Import after mocking
import { POST } from "@/app/api/activity/join/route";

describe("POST /api/activity/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to default behavior
    mockSelectActivity.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            activity_id: dbActivityRecord.activity_id,
            max_attendees: 10,
          },
          error: null,
        }),
      }),
    });

    mockInsertAttendee.mockResolvedValue({ error: null });
    mockSelectCount.mockResolvedValue({ count: 5, error: null });
  });

  const createRequest = (body: unknown, authToken?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["authorization"] = `Bearer ${authToken}`;
    }
    return new NextRequest("http://localhost:3000/api/activity/join", {
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

    it("should return 404 if activity does not exist", async () => {
      mockSelectActivity.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        }),
      });

      const request = createRequest({ activityId: "nonexistent" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Activity not found");
    });
  });

  describe("Business Logic", () => {
    it("should return 400 if already attending", async () => {
      mockSelectAttendee.mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({
          data: { id: "existing" }, // Already attending
          error: null,
        }),
      });

      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Already attending");
    });

    it("should return 400 if activity is full", async () => {
      // Set activity max to 5 and count to 5
      mockSelectActivity.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              activity_id: "act_test_1",
              max_attendees: 5,
            },
            error: null,
          }),
        }),
      });

      mockSelectCount.mockResolvedValueOnce({ count: 5, error: null });

      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Activity is full");
    });

    it("should successfully join activity when not full", async () => {
      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("success", true);
    });

    it("should insert attendee record on success", async () => {
      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      await POST(request);

      expect(mockInsertAttendee).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle database insert error", async () => {
      mockInsertAttendee.mockResolvedValueOnce({
        error: { message: "Database error" },
      });

      const request = createRequest({ activityId: "act_test_1" }, "valid_token");
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to join activity");
    });
  });
});
