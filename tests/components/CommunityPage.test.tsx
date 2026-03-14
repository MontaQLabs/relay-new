/**
 * Component tests for CommunityPage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../setup/test-utils";
import { WALLET_KEY } from "@/app/types/constants";
import { testWallet, testCommunities, TEST_WALLET_ADDRESS } from "../setup/fixtures";

// Store original fetch
const originalFetch = global.fetch;

// Mock auth utilities
const mockAuthenticateWithWallet = vi.fn();
const mockIsAuthenticated = vi.fn();

vi.mock("@/app/utils/auth", () => ({
  authenticateWithWallet: () => mockAuthenticateWithWallet(),
  isAuthenticated: () => mockIsAuthenticated(),
}));

// Mock wallet utilities
const mockGetWalletAddress = vi.fn();

vi.mock("@/app/utils/wallet", () => ({
  getWalletAddress: () => mockGetWalletAddress(),
}));

// Import after mocking
import CommunityPage from "@/app/dashboard/community/page";
import { mockRouter } from "../setup/test-utils";

describe("CommunityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(WALLET_KEY, JSON.stringify(testWallet));

    // Default mock implementations
    mockIsAuthenticated.mockReturnValue(true);
    mockGetWalletAddress.mockReturnValue(TEST_WALLET_ADDRESS);
    mockAuthenticateWithWallet.mockResolvedValue({
      success: true,
      walletAddress: TEST_WALLET_ADDRESS,
    });

    // Mock fetch globally
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/community?type=all")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ communities: testCommunities }),
        });
      }
      if (url.includes("/api/community?type=joined")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ communities: [testCommunities[1]] }),
        });
      }
      if (url.includes("/api/community?type=created")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ communities: [testCommunities[0]] }),
        });
      }
      if (url.includes("/api/community/search")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ communities: testCommunities }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Rendering", () => {
    it("should render tab navigation", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("All")).toBeInTheDocument();
        expect(screen.getByText("Joined")).toBeInTheDocument();
        expect(screen.getByText("Created")).toBeInTheDocument();
      });
    });

    it("should render search box", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search communities/i)).toBeInTheDocument();
      });
    });

    it("should render create community button", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("Create a Community")).toBeInTheDocument();
      });
    });
  });

  describe("Tab Navigation", () => {
    it("should default to All tab", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        const allTab = screen.getByText("All");
        expect(allTab.closest("button")).toHaveClass("text-black");
      });
    });

    it("should switch to Joined tab on click", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("Joined")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Joined"));

      await waitFor(() => {
        const joinedTab = screen.getByText("Joined");
        expect(joinedTab.closest("button")).toHaveClass("text-black");
      });
    });

    it("should switch to Created tab on click", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("Created")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Created"));

      await waitFor(() => {
        const createdTab = screen.getByText("Created");
        expect(createdTab.closest("button")).toHaveClass("text-black");
      });
    });

    it("should fetch communities based on active tab", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("type=all"));
      });
    });
  });

  describe("Create Community", () => {
    it("should navigate to create community page on click", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("Create a Community")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Create a Community"));

      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard/community/create-community");
    });
  });

  describe("Community List", () => {
    it("should display communities", async () => {
      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("Test Community")).toBeInTheDocument();
      });
    });
  });

  describe("Authentication Error", () => {
    it("should show error banner when auth fails", async () => {
      mockIsAuthenticated.mockReturnValue(false);
      mockAuthenticateWithWallet.mockResolvedValue({
        success: false,
        error: "No wallet found",
      });

      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("No wallet found")).toBeInTheDocument();
      });
    });

    it("should still show page content when auth fails", async () => {
      mockIsAuthenticated.mockReturnValue(false);
      mockAuthenticateWithWallet.mockResolvedValue({
        success: false,
        error: "Authentication failed",
      });

      render(<CommunityPage />);

      await waitFor(() => {
        expect(screen.getByText("Create a Community")).toBeInTheDocument();
      });
    });
  });
});
