import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { createRequire } from "node:module";

const { version } = createRequire(import.meta.url)("./package.json") as { version: string };

export default defineConfig({
  root: resolve("src/renderer"),
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@shared": resolve("src/shared"),
    },
  },
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4317,
    strictPort: true,
  },
});
