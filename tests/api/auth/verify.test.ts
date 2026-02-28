/**
 * API Route tests for /api/auth/verify
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TEST_WALLET_ADDRESS, dbNonceRecord } from "../../setup/fixtures";

// Mock Polkadot crypto
vi.mock("@polkadot/util-crypto", () => ({
  cryptoWaitReady: vi.fn().mockResolvedValue(true),
  signatureVerify: vi.fn((message: string, signature: Buffer, address: string) => ({
    isValid: address === TEST_WALLET_ADDRESS,
  })),
}));

// Track mock calls
const mockSelect = vi.fn();
const mockDeleteNonce = vi.fn();
const mockUpsertUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "auth_nonces") {
        return {
          select: mockSelect.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: dbNonceRecord,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          delete: mockDeleteNonce.mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "users") {
        return {
          upsert: mockUpsertUser.mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  })),
}));

// Mock jose for JWT signing
vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock.jwt.token"),
  })),
}));

// Import after mocking
import { POST } from "@/app/api/auth/verify/route";

describe("POST /api/auth/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to valid nonce record by default
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: dbNonceRecord,
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  const createRequest = (body: unknown) => {
    return new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  const validSignature = "0102030405060708091011121314151617181920";

  describe("Input Validation", () => {
    it("should return 400 if walletAddress is missing", async () => {
      const request = createRequest({
        signature: validSignature,
        nonce: "test_nonce",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 if signature is missing", async () => {
      const request = createRequest({
        walletAddress: TEST_WALLET_ADDRESS,
        nonce: "test_nonce",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 if nonce is missing", async () => {
      const request = createRequest({
        walletAddress: TEST_WALLET_ADDRESS,
        signature: validSignature,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 for invalid wallet address format", async () => {
      const request = createRequest({
        walletAddress: "invalid",
        signature: validSignature,
        nonce: "test_nonce",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid wallet address");
    });
  });

  describe("Nonce Validation", () => {
    it("should return 401 if nonce does not exist", async () => {
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            }),
          }),
        }),
      });

      const request = createRequest({
        walletAddress: TEST_WALLET_ADDRESS,
        signature: validSignature,
        nonce: "nonexistent_nonce",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Invalid or expired nonce");
    });

    it("should return 401 if nonce message is missing", async () => {
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...dbNonceRecord, message: null },
                error: null,
              }),
            }),
          }),
        }),
      });

      const request = createRequest({
        walletAddress: TEST_WALLET_ADDRESS,
        signature: validSignature,
        nonce: dbNonceRecord.nonce,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("missing message");
    });
  });

  describe("Signature Verification", () => {
    it("should return 401 for invalid signature", async () => {
      // Use a different wallet address that will fail verification
      const request = createRequest({
        walletAddress: "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
        signature: validSignature,
        nonce: dbNonceRecord.nonce,
      });

      // Update mock to return nonce for this address
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...dbNonceRecord,
                  wallet_address: "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Invalid signature");
    });

    it("should return JWT token for valid signature", async () => {
      const request = createRequest({
        walletAddress: TEST_WALLET_ADDRESS,
        signature: validSignature,
        nonce: dbNonceRecord.nonce,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("token");
      expect(data.token).toBeTruthy();
    });
  });

  describe("Post-Verification Actions", () => {
    it("should delete used nonce after successful verification", async () => {
      const request = createRequest({
        walletAddress: TEST_WALLET_ADDRESS,
        signature: validSignature,
        nonce: dbNonceRecord.nonce,
      });
      await POST(request);

      expect(mockDeleteNonce).toHaveBeenCalled();
    });

    it("should upsert user after successful verification", async () => {
      const request = createRequest({
        walletAddress: TEST_WALLET_ADDRESS,
        signature: validSignature,
        nonce: dbNonceRecord.nonce,
      });
      await POST(request);

      expect(mockUpsertUser).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed JSON body", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/verify", {
        method: "POST",
        body: "not valid json",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });
});
