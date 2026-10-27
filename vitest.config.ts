import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The provider-free behavioral-runner regressions use native ESM (.mjs).
    // Keep them in the same required suite as the TypeScript runtime tests.
    include: ["test/**/*.test.ts", "test/**/*.test.mjs"],
    // Several tests legitimately spawn fake CLI processes and poll with
    // vi.waitFor (background-agent launch/cancellation, profile-creator smoke
    // tests) and run ~5-6s locally. The 5s vitest default leaves them at the
    // flake boundary under CI load, so bound them explicitly and generously.
    testTimeout: 15_000,
  },
});
