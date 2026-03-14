/**
 * Component tests for EmptyState
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "../setup/test-utils";

// Import component
import { EmptyState } from "@/components/empty-state";

describe("EmptyState", () => {
  describe('Rendering for "all" tab', () => {
    it("should render title for all tab", () => {
      render(<EmptyState activeTab="all" />);
      expect(screen.getByText("No communities yet")).toBeInTheDocument();
    });

    it("should render description for all tab", () => {
      render(<EmptyState activeTab="all" />);
      expect(screen.getByText(/be the first to create/i)).toBeInTheDocument();
    });
  });

  describe('Rendering for "joined" tab', () => {
    it("should render title for joined tab", () => {
      render(<EmptyState activeTab="joined" />);
      expect(screen.getByText(/haven't joined/i)).toBeInTheDocument();
    });

    it("should render description for joined tab", () => {
      render(<EmptyState activeTab="joined" />);
      expect(screen.getByText(/create a community or search/i)).toBeInTheDocument();
    });
  });

  describe('Rendering for "created" tab', () => {
    it("should render title for created tab", () => {
      render(<EmptyState activeTab="created" />);
      expect(screen.getByText(/haven't created/i)).toBeInTheDocument();
    });

    it("should render description for created tab", () => {
      render(<EmptyState activeTab="created" />);
      expect(screen.getByText(/become a leader/i)).toBeInTheDocument();
    });
  });

  describe("Image rendering", () => {
    it("should render empty box illustration", () => {
      render(<EmptyState activeTab="all" />);
      const image = screen.getByAltText("Empty Box Illustration");
      expect(image).toBeInTheDocument();
    });

    it("should have correct image source", () => {
      render(<EmptyState activeTab="all" />);
      const image = screen.getByAltText("Empty Box Illustration");
      expect(image).toHaveAttribute("src", expect.stringContaining("empty-box"));
    });
  });

  describe("Layout", () => {
    it("should have centered content", () => {
      const { container } = render(<EmptyState activeTab="all" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("items-center");
      expect(wrapper.className).toContain("justify-center");
    });

    it("should have text centered", () => {
      const { container } = render(<EmptyState activeTab="all" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("text-center");
    });
  });

  describe("Accessibility", () => {
    it("should have properly structured heading", () => {
      render(<EmptyState activeTab="all" />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeInTheDocument();
    });

    it("should have descriptive alt text for image", () => {
      render(<EmptyState activeTab="all" />);
      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("alt");
    });
  });
});
