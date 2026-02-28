import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup/setup.ts"],
    include: ["./tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "app/utils/**/*.ts",
        "app/api/**/*.ts",
        "app/db/**/*.ts",
        "app/dashboard/**/*.tsx",
        "app/login/**/*.tsx",
        "components/**/*.tsx",
      ],
      exclude: ["node_modules", "tests", "**/*.d.ts", "**/*.test.{ts,tsx}"],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
