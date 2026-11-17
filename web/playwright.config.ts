import { defineConfig } from "@playwright/test";

// Uses the Chrome already installed on the machine, so no browser download is needed.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3200", channel: "chrome" },
  webServer: {
    command: "pnpm dev --port 3200",
    url: "http://localhost:3200",
    reuseExistingServer: true,
  },
});
