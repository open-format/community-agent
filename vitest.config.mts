import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const config = defineConfig({
  plugins: [tsconfigPaths({ root: "./" })],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./tests/utils/setup.ts",
  },
});

export default config;
