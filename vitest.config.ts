import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = {
  "@renderer": resolve("src/renderer/src"),
  "@shared": resolve("src/shared"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // Main process and shared logic: no DOM, and deliberately kept that way
        // so this stays fast.
        resolve: { alias },
        test: {
          name: "node",
          include: ["src/main/**/*.test.ts", "src/shared/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "renderer",
          include: ["src/renderer/**/*.test.ts", "src/renderer/**/*.test.tsx"],
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/renderer/src/test/setup.ts"],
        },
      },
    ],
  },
});
