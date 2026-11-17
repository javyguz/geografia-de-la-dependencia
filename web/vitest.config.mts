import { defineConfig } from "vitest/config";

export default defineConfig({
  // The browser tests in e2e/ are run by Playwright, not Vitest.
  test: { include: ["lib/**/*.test.ts"] },
});
