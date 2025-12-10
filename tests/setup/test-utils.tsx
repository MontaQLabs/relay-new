/**
 * Test utilities for React component testing
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock Next.js router
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

// Mock useRouter hook
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/dashboard/wallet',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add custom options here if needed
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  return render(ui, {
    ...options,
  });
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { customRender as render };

// Helper to reset all mocks between tests
export const resetMocks = () => {
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.back.mockReset();
  mockRouter.forward.mockReset();
  mockRouter.refresh.mockReset();
  mockRouter.prefetch.mockReset();
};

// Helper to simulate localStorage with specific data
export const setupLocalStorage = (data: Record<string, string>) => {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
};

// Helper to wait for async operations
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

