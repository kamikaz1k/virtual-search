import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/virtual-search/" : "/",
  plugins: [react(), vue()],
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
        find: /^virtual-search\/vue$/,
        replacement: new URL(
          "../../packages/virtual-search/src/vue/index.ts",
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
}));
