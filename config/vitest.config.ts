import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".."),
      "server-only": path.resolve(__dirname, "../tests/__mocks__/server-only.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/api/**/*.test.ts",
      "tests/game/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["**/*.d.ts", "node_modules"],
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "/tmp/coverage-report",
    },
  },
});
