/**
 * Component tests for ActionButton
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../setup/test-utils';
import React from 'react';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Import after mocking
import { ActionButton } from '@/components/action-button';

describe('ActionButton', () => {
  const TestIcon = () => <svg data-testid="test-icon" />;

  describe('Rendering', () => {
    it('should render with icon and label', () => {
      render(<ActionButton icon={<TestIcon />} label="Test Label" />);

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('should render as a button element', () => {
      render(<ActionButton icon={<TestIcon />} label="Test" />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should render label text correctly', () => {
      render(<ActionButton icon={<TestIcon />} label="Custom Label" />);

      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should be clickable', () => {
      render(<ActionButton icon={<TestIcon />} label="Click Me" />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should handle click events', () => {
      const handleClick = vi.fn();
      render(
        <div onClick={handleClick}>
          <ActionButton icon={<TestIcon />} label="Click Me" />
        </div>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should have proper button styling', () => {
      render(<ActionButton icon={<TestIcon />} label="Styled" />);

      const button = screen.getByRole('button');
      // Check that it has some styling classes
      expect(button.className).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should be focusable', () => {
      render(<ActionButton icon={<TestIcon />} label="Focus Me" />);

      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should have accessible text content', () => {
      render(<ActionButton icon={<TestIcon />} label="Accessible" />);

      expect(screen.getByText('Accessible')).toBeInTheDocument();
    });
  });
});

