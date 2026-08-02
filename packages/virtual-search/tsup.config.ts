import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "react-window/index": "src/react-window/index.ts",
    "react-virtuoso/index": "src/react-virtuoso/index.ts",
    "tanstack/index": "src/tanstack/index.ts",
    "vue/index": "src/vue/index.ts",
    "worker/index": "src/worker/index.ts",
    "worker/runtime": "src/worker/runtime.ts",
  },
  format: ["esm"],
  sourcemap: true,
  clean: true,
  splitting: true,
  target: "es2022",
});
