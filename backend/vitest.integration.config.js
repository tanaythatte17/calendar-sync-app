import { defineConfig } from "vitest/config";

// Integration config: spins up a real (in-memory) MongoDB and exercises
// actual route handlers end-to-end via supertest. Kept separate from the
// unit config so unit tests stay fast and CI can report the two suites
// independently.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.js"],
    setupFiles: ["./tests/setup/env.js", "./tests/setup/mongoMemoryServer.js"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
