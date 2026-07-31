import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^virtual-search\/worker\/runtime$/,
        replacement: new URL(
          "../../packages/virtual-search/src/worker/runtime.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^virtual-search\/react$/,
        replacement: new URL(
          "../../packages/virtual-search/src/react/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^virtual-search\/tanstack$/,
        replacement: new URL(
          "../../packages/virtual-search/src/tanstack/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^virtual-search\/worker$/,
        replacement: new URL(
          "../../packages/virtual-search/src/worker/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^virtual-search$/,
        replacement: new URL(
          "../../packages/virtual-search/src/index.ts",
          import.meta.url,
        ).pathname,
      },
    ],
  },
});
