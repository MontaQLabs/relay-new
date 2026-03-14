/**
 * Global test setup file
 * Configures mocks, global utilities, and test environment
 */

import { vi, beforeEach, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

// Set up global mocks
beforeAll(() => {
  // Mock localStorage
  Object.defineProperty(global, "localStorage", {
    value: localStorageMock,
    writable: true,
  });

  // Mock window.isSecureContext
  Object.defineProperty(global, "isSecureContext", {
    value: true,
    writable: true,
  });

  // Mock fetch
  global.fetch = vi.fn();

  // Mock crypto for Web Crypto API
  if (!global.crypto) {
    global.crypto = {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array) {
          const bytes = array as unknown as Uint8Array;
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
          }
        }
        return array;
      },
      randomUUID: () => {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      },
      subtle: {
        importKey: vi.fn(),
        deriveKey: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        digest: vi.fn(),
      },
    } as unknown as Crypto;
  }
});

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Export localStorage mock for direct manipulation in tests
export { localStorageMock };
