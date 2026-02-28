/**
 * Component tests for SeedPhraseDisplay
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../setup/test-utils";

// Import component
import SeedPhraseDisplay from "@/components/SeedPhraseDisplay";

describe("SeedPhraseDisplay", () => {
  // Use unique test words that won't appear elsewhere in the UI
  const mockWords = [
    "abandon",
    "ability",
    "able",
    "about",
    "above",
    "absent",
    "absorb",
    "abstract",
    "absurd",
    "abuse",
    "access",
    "accident",
  ];

  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: clipboardWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  describe("Initial Hidden State", () => {
    it("should render reveal button initially", () => {
      render(<SeedPhraseDisplay words={mockWords} />);
      expect(screen.getByText("Reveal")).toBeInTheDocument();
    });

    it("should show warning message", () => {
      render(<SeedPhraseDisplay words={mockWords} />);
      expect(screen.getByText(/nobody is looking/i)).toBeInTheDocument();
    });

    it("should not show first word initially", () => {
      render(<SeedPhraseDisplay words={mockWords} />);
      // First word should not be visible
      expect(screen.queryByText("abandon")).not.toBeInTheDocument();
    });

    it("should render blurred placeholder cards", () => {
      const { container } = render(<SeedPhraseDisplay words={mockWords} />);

      // Should have blurred elements
      const blurredElements = container.querySelectorAll(".blur-sm");
      expect(blurredElements.length).toBe(12);
    });
  });

  describe("Reveal Functionality", () => {
    it("should reveal first word when reveal button is clicked", async () => {
      render(<SeedPhraseDisplay words={mockWords} />);

      const revealButton = screen.getByText("Reveal");
      fireEvent.click(revealButton);

      await waitFor(() => {
        expect(screen.getByText("abandon")).toBeInTheDocument();
      });
    });

    it("should reveal last word when reveal button is clicked", async () => {
      render(<SeedPhraseDisplay words={mockWords} />);

      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        expect(screen.getByText("accident")).toBeInTheDocument();
      });
    });

    it("should show word numbers after reveal", async () => {
      render(<SeedPhraseDisplay words={mockWords} />);

      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        // Check for numbered indicators
        expect(screen.getByText("1.")).toBeInTheDocument();
        expect(screen.getByText("12.")).toBeInTheDocument();
      });
    });

    it("should hide reveal button after reveal", async () => {
      render(<SeedPhraseDisplay words={mockWords} />);

      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        expect(screen.queryByText("Reveal")).not.toBeInTheDocument();
      });
    });

    it("should show copy button after reveal", async () => {
      render(<SeedPhraseDisplay words={mockWords} />);

      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        expect(screen.getByText(/copy to clipboard/i)).toBeInTheDocument();
      });
    });
  });

  describe("Copy Functionality", () => {
    it("should copy words to clipboard when copy button is clicked", async () => {
      render(<SeedPhraseDisplay words={mockWords} />);

      // First reveal
      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        expect(screen.getByText(/copy to clipboard/i)).toBeInTheDocument();
      });

      // Then copy
      fireEvent.click(screen.getByText(/copy to clipboard/i));

      await waitFor(() => {
        expect(clipboardWriteText).toHaveBeenCalledWith(mockWords.join(" "));
      });
    });

    it("should show copied confirmation", async () => {
      render(<SeedPhraseDisplay words={mockWords} />);

      // Reveal
      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        expect(screen.getByText(/copy to clipboard/i)).toBeInTheDocument();
      });

      // Copy
      fireEvent.click(screen.getByText(/copy to clipboard/i));

      await waitFor(() => {
        expect(screen.getByText("Copied!")).toBeInTheDocument();
      });
    });

    it("should call onCopy callback when provided", async () => {
      const onCopy = vi.fn();
      render(<SeedPhraseDisplay words={mockWords} onCopy={onCopy} />);

      // Reveal
      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        expect(screen.getByText(/copy to clipboard/i)).toBeInTheDocument();
      });

      // Copy
      fireEvent.click(screen.getByText(/copy to clipboard/i));

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalled();
      });
    });
  });

  describe("Different Word Counts", () => {
    it("should handle 24 words", async () => {
      const twentyFourWords = [...mockWords, ...mockWords];
      render(<SeedPhraseDisplay words={twentyFourWords} />);

      fireEvent.click(screen.getByText("Reveal"));

      await waitFor(() => {
        expect(screen.getByText("24.")).toBeInTheDocument();
      });
    });

    it("should handle empty words array gracefully", () => {
      const { container } = render(<SeedPhraseDisplay words={[]} />);
      expect(container).toBeInTheDocument();
    });
  });
});
