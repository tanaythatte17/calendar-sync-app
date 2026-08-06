import { defineConfig } from "vitest/config";

// Base config, used for fast unit tests: no database, no network.
// Anything under tests/unit should be mockable and run in milliseconds.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.js"],
    setupFiles: ["./tests/setup/env.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["controllers/**", "services/**", "utils/**", "middleware/**"],
    },
  },
});
