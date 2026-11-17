import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// The key lives in the repository's .env, never in the code (see .env.example).
if (existsSync("../.env")) process.loadEnvFile("../.env");

export default defineConfig({
  test: {
    include: ["eval/**/*.eval.ts"],
    // Each question is a few round trips to a remote model.
    testTimeout: 180_000,
    maxConcurrency: Number(process.env.BOT_CONCURRENCY ?? 3),
  },
});
