/**
 * Component tests for LoginPage
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../setup/test-utils";
import { IS_ENCRYPTED_KEY, USER_KEY } from "@/app/types/constants";
import { testWallet, testUser } from "../setup/fixtures";

// Mock wallet utilities
const mockDecryptWallet = vi.fn();

vi.mock("@/app/utils/wallet", () => ({
  decryptWallet: (...args: unknown[]) => mockDecryptWallet(...args),
}));

// Import after mocking
import LoginPage from "@/app/login/page";
import { mockRouter } from "../setup/test-utils";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockDecryptWallet.mockResolvedValue(testWallet);
  });

  describe("Rendering", () => {
    it("should render welcome text", () => {
      render(<LoginPage />);
      expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    });

    it("should render unlock button", () => {
      render(<LoginPage />);
      expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();
    });

    it("should render forgot password button", () => {
      render(<LoginPage />);
      expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
    });

    it("should render logo image", () => {
      render(<LoginPage />);
      expect(screen.getByAltText("Relay Logo")).toBeInTheDocument();
    });
  });

  describe("Password Field", () => {
    it("should show password field when wallet is encrypted", () => {
      render(<LoginPage />);
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("should hide password field when already unlocked", () => {
      localStorage.setItem(IS_ENCRYPTED_KEY, "false");
      localStorage.setItem(USER_KEY, JSON.stringify(testUser));

      render(<LoginPage />);
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    });

    it("should toggle password visibility", () => {
      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText(/enter password/i);
      const toggleButton = screen.getByRole("button", { name: /show password/i });

      expect(passwordInput).toHaveAttribute("type", "password");

      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");

      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("should update password value on input", () => {
      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText(/enter password/i) as HTMLInputElement;

      fireEvent.change(passwordInput, { target: { value: "testpassword" } });
      expect(passwordInput.value).toBe("testpassword");
    });
  });

  describe("Unlock Button", () => {
    it("should be disabled when password is empty", () => {
      render(<LoginPage />);
      const unlockButton = screen.getByRole("button", { name: /unlock/i });
      expect(unlockButton).toBeDisabled();
    });

    it("should be enabled when password is entered", () => {
      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText(/enter password/i);
      const unlockButton = screen.getByRole("button", { name: /unlock/i });

      fireEvent.change(passwordInput, { target: { value: "testpassword" } });
      expect(unlockButton).not.toBeDisabled();
    });

    it("should be enabled when already unlocked (no password needed)", () => {
      localStorage.setItem(IS_ENCRYPTED_KEY, "false");
      localStorage.setItem(USER_KEY, JSON.stringify(testUser));

      render(<LoginPage />);
      const unlockButton = screen.getByRole("button", { name: /unlock/i });
      expect(unlockButton).not.toBeDisabled();
    });
  });

  describe("Unlock Flow", () => {
    it("should navigate to dashboard when already unlocked", async () => {
      localStorage.setItem(IS_ENCRYPTED_KEY, "false");
      localStorage.setItem(USER_KEY, JSON.stringify(testUser));

      render(<LoginPage />);
      const unlockButton = screen.getByRole("button", { name: /unlock/i });

      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/dashboard/wallet");
      });
    });

    it("should call decryptWallet with password", async () => {
      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText(/enter password/i);
      const unlockButton = screen.getByRole("button", { name: /unlock/i });

      fireEvent.change(passwordInput, { target: { value: "testpassword" } });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(mockDecryptWallet).toHaveBeenCalledWith("testpassword");
      });
    });

    it("should navigate to dashboard on successful decrypt", async () => {
      mockDecryptWallet.mockResolvedValue(testWallet);

      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText(/enter password/i);
      const unlockButton = screen.getByRole("button", { name: /unlock/i });

      fireEvent.change(passwordInput, { target: { value: "correctpassword" } });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/dashboard/wallet");
      });
    });

    it("should show alert on wrong password", async () => {
      mockDecryptWallet.mockResolvedValue(null);
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText(/enter password/i);
      const unlockButton = screen.getByRole("button", { name: /unlock/i });

      fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Wrong password");
      });

      alertSpy.mockRestore();
    });
  });

  describe("Forgot Password", () => {
    it("should be disabled (feature not implemented)", () => {
      render(<LoginPage />);
      const forgotButton = screen.getByText(/forgot your password/i).closest("button");
      expect(forgotButton).toBeDisabled();
    });
  });
});
