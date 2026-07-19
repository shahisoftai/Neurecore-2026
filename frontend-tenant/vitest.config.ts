import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/app/**"],
      thresholds: {
        // Phase F — chat unification gates
        "src/core/services/chat/**": {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
        "src/shared/components/chat/**": {
          lines: 60,
          functions: 60,
          branches: 50,
          statements: 60,
        },
        "src/shared/hooks/useChat.ts": {
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
